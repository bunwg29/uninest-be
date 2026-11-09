import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { Listing } from '@modules/listings/entities/listing';
import { ListingStatus } from '@modules/listings/entities/listing-status';
import { AiChatCriteria } from './ai-criteria.types';

interface MatchRow {
  id: string;
}

export interface RetrievalResult {
  listingIds: string[];
  matchedCount: number;
}

@Injectable()
export class AiRetrievalService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findMatches(
    criteria: AiChatCriteria,
    embedding: number[] | null,
    limit: number,
  ): Promise<RetrievalResult> {
    const query = this.createFilteredQuery(criteria)
      .select('listing.id', 'id')
      .leftJoin(
        'listing_embeddings',
        'embedding',
        'embedding.listing_id = listing.id',
      );

    if (embedding) {
      query
        .addSelect(
          'embedding.embedding <=> CAST(:queryEmbedding AS vector)',
          'distance',
        )
        .setParameter('queryEmbedding', `[${embedding.join(',')}]`)
        .orderBy('distance', 'ASC', 'NULLS LAST');
    } else {
      query.orderBy('listing.viewCount', 'DESC');
    }

    query.addOrderBy('listing.createdAt', 'DESC').limit(limit);

    const [rows, matchedCount] = await Promise.all([
      query.getRawMany<MatchRow>(),
      this.countMatches(criteria),
    ]);

    return { listingIds: rows.map((row) => row.id), matchedCount };
  }

  countMatches(criteria: AiChatCriteria): Promise<number> {
    return this.createFilteredQuery(criteria).getCount();
  }

  countActive(): Promise<number> {
    return this.createFilteredQuery({}).getCount();
  }

  private createFilteredQuery(
    criteria: AiChatCriteria,
  ): SelectQueryBuilder<Listing> {
    const query = this.dataSource
      .getRepository(Listing)
      .createQueryBuilder('listing')
      .where('listing.status = :activeStatus', {
        activeStatus: ListingStatus.ACTIVE,
      })
      .andWhere('listing.deletedAt IS NULL');

    if (criteria.minPrice !== undefined) {
      query.andWhere('listing.price >= :minPrice', {
        minPrice: criteria.minPrice,
      });
    }

    if (criteria.maxPrice !== undefined) {
      query.andWhere('listing.price <= :maxPrice', {
        maxPrice: criteria.maxPrice,
      });
    }

    if (criteria.minArea !== undefined) {
      query.andWhere('listing.area >= :minArea', { minArea: criteria.minArea });
    }

    if (criteria.roomTypes?.length) {
      query.andWhere('listing.roomType IN (:...roomTypes)', {
        roomTypes: criteria.roomTypes,
      });
    }

    if (criteria.wardCode) {
      query.andWhere('listing.wardCode = :wardCode', {
        wardCode: criteria.wardCode,
      });
    } else if (criteria.provinceCode) {
      query.andWhere('listing.provinceCode = :provinceCode', {
        provinceCode: criteria.provinceCode,
      });
    }

    if (criteria.universityCode) {
      query.andWhere(
        'EXISTS (SELECT 1 FROM listing_universities lu WHERE lu.listing_id = listing.id AND lu.university_code = :universityCode)',
        { universityCode: criteria.universityCode },
      );
    }

    if (criteria.amenityIds?.length) {
      query.andWhere(
        '(SELECT COUNT(DISTINCT la.amenity_id) FROM listing_amenities la WHERE la.listing_id = listing.id AND la.amenity_id IN (:...amenityIds)) = :amenityCount',
        {
          amenityIds: criteria.amenityIds,
          amenityCount: criteria.amenityIds.length,
        },
      );
    }

    return query;
  }
}
