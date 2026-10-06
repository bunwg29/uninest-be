import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { R2StorageService } from '@core/storage';
import {
  findActiveHolds,
  type ListingHoldInfo,
} from '@modules/booking/booking-availability';
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
  SEARCH_ROOM_TYPE_DATABASE_VALUES,
  SEARCH_ROOM_TYPE_RESPONSE_VALUES,
} from './search.constants';
import type { NormalizedSearchQuery } from './search.service';

interface SearchListingRow {
  id: string;
  distanceMeters?: number | string | null;
}

const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const SEARCH_DISTANCE_SQL = `ST_Distance(${SEARCH_LISTING_GEOGRAPHY_SQL}, ${SEARCH_REFERENCE_POINT_SQL})`;

@Injectable()
export class ListingsSearchRepository {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    private readonly storageService: R2StorageService,
    private readonly dataSource: DataSource,
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
        hasResults: total > 0,
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
      hasResults: true,
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
      hasResults: items.length > 0,
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
    const holds = await findActiveHolds(this.dataSource, listingIds);

    return rows.flatMap((row) => {
      const listing = listingsById.get(row.id);

      return listing
        ? [this.toSearchListing(listing, row, holds.get(listing.id))]
        : [];
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

    if (query.keyword) {
      listingsQuery.andWhere(
        '(unaccent(listing.title) ILIKE unaccent(:keyword) OR unaccent(listing.fullAddress) ILIKE unaccent(:keyword))',
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
      const databaseRoomTypes = [
        ...new Set(
          query.roomTypes.flatMap(
            (roomType) => SEARCH_ROOM_TYPE_DATABASE_VALUES[roomType],
          ),
        ),
      ];

      listingsQuery.andWhere('listing.roomType IN (:...roomTypes)', {
        roomTypes: databaseRoomTypes,
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
      case 'distance':
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
          'CASE WHEN unaccent(listing.title) ILIKE unaccent(:keyword) THEN 0 ELSE 1 END',
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
    hold?: ListingHoldInfo,
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
      roomType:
        SEARCH_ROOM_TYPE_RESPONSE_VALUES[listing.roomType] ?? listing.roomType,
      amenityIds: (listing.listingAmenities ?? [])
        .map((item) => item.amenityId)
        .sort((first, second) => first - second),
      location: {
        latitude: listing.location.coordinates[1],
        longitude: listing.location.coordinates[0],
      },
      distanceMeters,
      isHighlighted: false,
      isReserved: hold !== undefined,
      availability: this.getAvailability(listing, hold),
      holdExpiresAt: hold?.expiresAt.toISOString() ?? null,
      capacity: listing.maxOccupants,
      description: listing.description ?? undefined,
      status: 'active',
      createdAt: listing.createdAt.toISOString(),
    };
  }

  private getAvailability(
    listing: Listing,
    hold?: ListingHoldInfo,
  ): SearchListingItemDto['availability'] {
    if (listing.status === ListingStatus.RENTED) return 'rented';

    return hold ? 'holding' : 'available';
  }
}
