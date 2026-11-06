import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { R2StorageService } from '@core/storage';
import { Favorite, Listing, ListingStatus } from '@modules/listings/entities';
import {
  SearchListingItemDto,
  SearchListingsResponseDto,
  SearchSuggestionDto,
} from './dto';
import {
  SEARCH_DEFAULTS,
  SEARCH_LISTING_GEOGRAPHY_SQL,
  SEARCH_REFERENCE_POINT_SQL,
} from './search.constants';
import type { NormalizedSearchQuery } from './search.service';
import { escapeLikePattern } from '@common/utils';

interface SearchListingRow {
  id: string;
  distanceMeters?: number | string | null;
}

const SEARCH_DISTANCE_SQL = `ST_Distance(${SEARCH_LISTING_GEOGRAPHY_SQL}, ${SEARCH_REFERENCE_POINT_SQL})`;

@Injectable()
export class ListingsSearchRepository {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    private readonly storageService: R2StorageService,
  ) {}

  async search(
    query: NormalizedSearchQuery,
  ): Promise<SearchListingsResponseDto> {
    const filteredQuery = this.createFilteredQuery(query);
    const total = await filteredQuery.clone().getCount();

    this.applySort(filteredQuery, query);

    const rows = await filteredQuery
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getRawMany<SearchListingRow>();

    if (rows.length === 0) {
      return {
        items: [],
        has_results: total > 0,
        suggestion: total === 0 ? this.createSuggestion(query) : undefined,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    }

    const items = await this.hydrateRows(rows);

    return {
      items,
      has_results: true,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async listFavorites(
    userId: string,
    page: number,
    limit: number,
  ): Promise<SearchListingsResponseDto> {
    const favoritesQuery = this.listingRepository
      .createQueryBuilder('listing')
      .select('listing.id', 'id')
      .innerJoin(
        Favorite,
        'favorite',
        'favorite.listing_id = listing.id AND favorite.user_id = :userId',
        { userId },
      )
      .where('listing.status = :activeStatus', {
        activeStatus: ListingStatus.ACTIVE,
      })
      .andWhere('listing.deletedAt IS NULL');
    const total = await favoritesQuery.clone().getCount();
    const rows = await favoritesQuery
      .orderBy('favorite.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<SearchListingRow>();
    const items = await this.hydrateRows(rows);

    return {
      items,
      has_results: items.length > 0,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listFavoriteIds(userId: string): Promise<string[]> {
    const rows = await this.listingRepository
      .createQueryBuilder('listing')
      .select('listing.id', 'id')
      .innerJoin(
        Favorite,
        'favorite',
        'favorite.listing_id = listing.id AND favorite.user_id = :userId',
        { userId },
      )
      .where('listing.status = :activeStatus', {
        activeStatus: ListingStatus.ACTIVE,
      })
      .andWhere('listing.deletedAt IS NULL')
      .orderBy('favorite.created_at', 'DESC')
      .getRawMany<{ id: string }>();

    return rows.map((row) => row.id);
  }

  private async hydrateRows(
    rows: SearchListingRow[],
  ): Promise<SearchListingItemDto[]> {
    if (rows.length === 0) return [];

    const listingIds = rows.map((row) => row.id);
    const listings = await this.listingRepository.find({
      where: { id: In(listingIds) },
      relations: { images: true, listingAmenities: true },
    });
    const listingsById = new Map(
      listings.map((listing) => [listing.id, listing]),
    );

    return rows.flatMap((row) => {
      const listing = listingsById.get(row.id);

      return listing ? [this.toSearchListing(listing, row)] : [];
    });
  }

  private createSuggestion(
    query: NormalizedSearchQuery,
  ): SearchSuggestionDto | undefined {
    if (
      query.radiusKm !== undefined &&
      query.radiusKm < SEARCH_DEFAULTS.MAX_RADIUS_KM
    ) {
      const radiusKm = Math.min(
        query.radiusKm * 2,
        SEARCH_DEFAULTS.MAX_RADIUS_KM,
      );

      return {
        type: 'expand_radius',
        radiusKm,
        message: `Thử mở rộng bán kính tìm kiếm lên ${radiusKm} km.`,
      };
    }

    const hasFilters =
      query.keyword !== undefined ||
      query.minPrice !== undefined ||
      query.maxPrice !== undefined ||
      query.minArea !== undefined ||
      query.maxArea !== undefined ||
      query.roomTypes.length > 0 ||
      query.amenities.length > 0;

    return hasFilters
      ? {
          type: 'relax_filters',
          message: 'Thử nới lỏng khoảng giá, loại phòng hoặc tiện ích.',
        }
      : undefined;
  }

  private createFilteredQuery(
    query: NormalizedSearchQuery,
  ): SelectQueryBuilder<Listing> {
    const listingsQuery = this.listingRepository
      .createQueryBuilder('listing')
      .select('listing.id', 'id')
      .where('listing.status = :activeStatus', {
        activeStatus: ListingStatus.ACTIVE,
      })
      .andWhere('listing.deletedAt IS NULL');

    if (query.universityCodes.length > 0) {
      listingsQuery.andWhere(
        'EXISTS (SELECT 1 FROM listing_universities lu WHERE lu.listing_id = listing.id AND lu.university_code IN (:...universityCodes))',
        { universityCodes: query.universityCodes },
      );
    }

    if (query.ownerId) {
      listingsQuery.andWhere('listing.ownerId = :ownerId', {
        ownerId: query.ownerId,
      });
    }

    if (query.keyword) {
      listingsQuery.andWhere(
        '(uninest_unaccent(listing.title) ILIKE uninest_unaccent(:keyword) OR uninest_unaccent(listing.fullAddress) ILIKE uninest_unaccent(:keyword))',
        { keyword: `%${escapeLikePattern(query.keyword)}%` },
      );
    }

    if (query.minPrice !== undefined) {
      listingsQuery.andWhere('listing.price >= :minPrice', {
        minPrice: query.minPrice,
      });
    }

    if (query.maxPrice !== undefined) {
      listingsQuery.andWhere('listing.price <= :maxPrice', {
        maxPrice: query.maxPrice,
      });
    }

    if (query.minArea !== undefined) {
      listingsQuery.andWhere('listing.area >= :minArea', {
        minArea: query.minArea,
      });
    }

    if (query.maxArea !== undefined) {
      listingsQuery.andWhere('listing.area <= :maxArea', {
        maxArea: query.maxArea,
      });
    }

    if (query.roomTypes.length > 0) {
      listingsQuery.andWhere('listing.roomType IN (:...roomTypes)', {
        roomTypes: query.roomTypes,
      });
    }

    if (query.amenities.length > 0) {
      listingsQuery.andWhere(
        `(
          SELECT COUNT(DISTINCT search_amenity.amenity_id)
          FROM listing_amenities search_amenity
          WHERE search_amenity.listing_id = listing.id
            AND search_amenity.amenity_id IN (:...amenityIds)
        ) = :amenityCount`,
        {
          amenityIds: query.amenities,
          amenityCount: query.amenities.length,
        },
      );
    }

    if (
      query.latitude !== undefined &&
      query.longitude !== undefined &&
      query.radiusKm !== undefined
    ) {
      listingsQuery
        .addSelect(SEARCH_DISTANCE_SQL, 'distanceMeters')
        .andWhere(
          `ST_DWithin(${SEARCH_LISTING_GEOGRAPHY_SQL}, ${SEARCH_REFERENCE_POINT_SQL}, :radiusMeters)`,
          {
            latitude: query.latitude,
            longitude: query.longitude,
            radiusMeters: query.radiusKm * 1000,
          },
        );
    }

    return listingsQuery;
  }

  private applySort(
    listingsQuery: SelectQueryBuilder<Listing>,
    query: NormalizedSearchQuery,
  ): void {
    switch (query.sortBy) {
      case 'price_asc':
        listingsQuery.orderBy('listing.price', 'ASC');
        break;
      case 'price_desc':
        listingsQuery.orderBy('listing.price', 'DESC');
        break;
      case 'area_asc':
        listingsQuery.orderBy('listing.area', 'ASC');
        break;
      case 'area_desc':
        listingsQuery.orderBy('listing.area', 'DESC');
        break;
      case 'nearest':
        listingsQuery.orderBy(SEARCH_DISTANCE_SQL, 'ASC');
        break;
      case 'newest':
        listingsQuery.orderBy('listing.createdAt', 'DESC');
        break;
      case 'relevance':
      default:
        this.applyRelevanceSort(listingsQuery, query);
        break;
    }

    listingsQuery.addOrderBy('listing.id', 'ASC');
  }

  private applyRelevanceSort(
    listingsQuery: SelectQueryBuilder<Listing>,
    query: NormalizedSearchQuery,
  ): void {
    if (query.keyword) {
      listingsQuery
        .addSelect(
          'CASE WHEN uninest_unaccent(listing.title) ILIKE uninest_unaccent(:keyword) THEN 0 ELSE 1 END',
          'keywordRank',
        )
        .orderBy('"keywordRank"', 'ASC');
    }

    if (query.latitude !== undefined) {
      listingsQuery.addOrderBy(SEARCH_DISTANCE_SQL, 'ASC');
    }

    listingsQuery.addOrderBy('listing.createdAt', 'DESC');
  }

  private toSearchListing(
    listing: Listing,
    row: SearchListingRow,
  ): SearchListingItemDto {
    const images = [...(listing.images ?? [])].sort(
      (first, second) => first.sortOrder - second.sortOrder,
    );
    const coverImage = images.find((image) => image.isCover) ?? images[0];
    const rawDistance =
      row.distanceMeters === null || row.distanceMeters === undefined
        ? undefined
        : Number(row.distanceMeters);
    const distanceMeters =
      rawDistance !== undefined && Number.isFinite(rawDistance)
        ? Math.round(rawDistance)
        : undefined;

    return {
      id: listing.id,
      title: listing.title,
      thumbnail: coverImage
        ? this.storageService.getPublicUrl(coverImage.url)
        : null,
      imageUrls: images.map((image) =>
        this.storageService.getPublicUrl(image.url),
      ),
      price: Number(listing.price),
      area: Number(listing.area),
      address: listing.fullAddress,
      roomType: listing.roomType,
      amenityIds: (listing.listingAmenities ?? [])
        .map((item) => item.amenityId)
        .sort((first, second) => first - second),
      location: {
        latitude: listing.location.coordinates[1],
        longitude: listing.location.coordinates[0],
      },
      distanceMeters,
      isHighlighted: false,
      availability: this.getAvailability(listing),
      averageRating:
        listing.reviewCount > 0 ? Number(listing.averageRating) : null,
      reviewCount: listing.reviewCount,
      capacity: listing.maxOccupants,
      description: listing.description ?? undefined,
      status: 'active',
      createdAt: listing.createdAt.toISOString(),
    };
  }

  private getAvailability(
    listing: Listing,
  ): SearchListingItemDto['availability'] {
    if (listing.status === ListingStatus.RENTED) return 'rented';

    return 'available';
  }
}
