import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { R2StorageService } from '@core/storage';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { SearchListingItemDto, SearchListingsResponseDto } from './dto';
import {
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
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    }

    const listingIds = rows.map((row) => row.id);
    const listings = await this.listingRepository.find({
      where: { id: In(listingIds) },
      relations: { images: true, listingAmenities: true },
    });
    const listingsById = new Map(
      listings.map((listing) => [listing.id, listing]),
    );
    const items = rows.flatMap((row) => {
      const listing = listingsById.get(row.id);

      return listing ? [this.toSearchListing(listing, row)] : [];
    });

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
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
        { keyword: `%${query.keyword}%` },
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
      default:
        listingsQuery.orderBy('listing.createdAt', 'DESC');
        break;
    }

    listingsQuery.addOrderBy('listing.id', 'ASC');
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
      isReserved: false,
      capacity: listing.maxOccupants,
      description: listing.description ?? undefined,
      status: 'active',
      stats: { views: 0, saved: 0 },
      createdAt: listing.createdAt.toISOString(),
    };
  }
}
