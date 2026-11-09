import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ListingStatus } from '@modules/listings/entities/listing-status';
import { User } from '@modules/users/entities';
import {
  BEHAVIOR_WEIGHTS,
  RECOMMENDATION_DEFAULTS,
  RECOMMENDATION_SCORE_WEIGHTS,
  UserBehaviorEventType,
} from '../constants';
import {
  SearchBehaviorFilters,
  UserRecommendation,
  UserRecommendationProfile,
} from '../entities';

interface PreferenceRow {
  province_code: string | null;
  ward_code: string | null;
  price_low: string | null;
  price_high: string | null;
  behavior_count: string;
  listing_count: string;
}

interface EmbeddingRow {
  embedding: string | null;
}

interface CandidateRow {
  id: string;
  province_code: string;
  ward_code: string;
  price: string;
  similarity: string | null;
}

interface SearchFiltersRow {
  filters: SearchBehaviorFilters | null;
}

interface UserIdRow {
  user_id: string;
}

interface UserPreference {
  provinceCode: string | null;
  wardCode: string | null;
  priceMin: number | null;
  priceMax: number | null;
  behaviorCount: number;
  listingCount: number;
}

interface ScoredListing {
  listingId: string;
  score: number;
}

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const isLockAcquired = (rows: unknown): boolean => {
  if (!Array.isArray(rows)) return false;

  const firstRow: unknown = rows[0];

  return (
    typeof firstRow === 'object' &&
    firstRow !== null &&
    'locked' in firstRow &&
    firstRow.locked === true
  );
};

@Injectable()
export class RecommendationEngineService {
  private readonly logger = new Logger(RecommendationEngineService.name);
  private isRunning = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Cron(RECOMMENDATION_DEFAULTS.CRON_EXPRESSION, {
    timeZone: RECOMMENDATION_DEFAULTS.TIME_ZONE,
  })
  async refreshAll(): Promise<number> {
    if (this.isRunning) return 0;

    this.isRunning = true;
    const queryRunner = this.dataSource.createQueryRunner();
    let refreshed = 0;

    try {
      await queryRunner.connect();
      const lockRows: unknown = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [RECOMMENDATION_DEFAULTS.ADVISORY_LOCK_ID],
      );

      if (!isLockAcquired(lockRows)) {
        this.logger.warn(
          'Recommendation refresh skipped because another instance holds the lock',
        );

        return 0;
      }

      try {
        const userIds = await this.findUsersToRefresh();

        for (const userId of userIds) {
          try {
            await this.computeForUser(userId);
            refreshed += 1;
          } catch (error: unknown) {
            this.logger.error(
              `Recommendation refresh failed for user ${userId}`,
              error instanceof Error ? error.stack : undefined,
            );
          }
        }
      } finally {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [
          RECOMMENDATION_DEFAULTS.ADVISORY_LOCK_ID,
        ]);
      }

      this.logger.log(
        `Recommendation refresh completed for ${refreshed} users`,
      );

      return refreshed;
    } finally {
      await queryRunner.release();
      this.isRunning = false;
    }
  }

  async computeForUser(userId: string): Promise<UserRecommendationProfile> {
    const since = this.getWindowStart();
    const preference = await this.loadPreference(userId, since);
    const isFallback =
      preference.behaviorCount <
      RECOMMENDATION_DEFAULTS.MIN_BEHAVIORS_FOR_PERSONALIZATION;
    const embedding = isFallback
      ? null
      : await this.loadBehaviorEmbedding(userId, since);
    const personalized = isFallback
      ? []
      : await this.scorePersonalizedCandidates(userId, preference, embedding);
    const fallbackProvinceCode =
      preference.provinceCode ?? (await this.findUserProvinceCode(userId));
    const missingCount =
      RECOMMENDATION_DEFAULTS.STORED_RECOMMENDATIONS - personalized.length;
    const fallback =
      missingCount > 0
        ? await this.findPopularListings(
            userId,
            fallbackProvinceCode,
            personalized.map((item) => item.listingId),
            missingCount,
          )
        : [];
    const computedAt = new Date();
    const recommendations = [...personalized, ...fallback];

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(UserRecommendation, { userId });

      if (recommendations.length > 0) {
        await manager.insert(
          UserRecommendation,
          recommendations.map((item, index) => ({
            userId,
            listingId: item.listingId,
            score: item.score,
            rank: index + 1,
            computedAt,
          })),
        );
      }

      const profile = manager.create(UserRecommendationProfile, {
        userId,
        embedding,
        preferredProvinceCode: preference.provinceCode,
        preferredWardCode: preference.wardCode,
        priceMin:
          preference.priceMin !== null ? String(preference.priceMin) : null,
        priceMax:
          preference.priceMax !== null ? String(preference.priceMax) : null,
        behaviorCount: preference.behaviorCount,
        interactedListingCount: preference.listingCount,
        isFallback: personalized.length === 0,
        computedAt,
      });

      return manager.save(UserRecommendationProfile, profile);
    });
  }

  async countRecentBehaviors(userId: string): Promise<number> {
    const rows: PreferenceRow[] = await this.dataSource.query(
      this.buildPreferenceSql(),
      this.buildPreferenceParameters(userId, this.getWindowStart()),
    );

    return Number(rows[0]?.behavior_count ?? 0);
  }

  private async loadPreference(
    userId: string,
    since: Date,
  ): Promise<UserPreference> {
    const rows: PreferenceRow[] = await this.dataSource.query(
      this.buildPreferenceSql(),
      this.buildPreferenceParameters(userId, since),
    );
    const row = rows[0];
    let priceLow = row?.price_low ? Number(row.price_low) : null;
    let priceHigh = row?.price_high ? Number(row.price_high) : null;

    if (priceLow === null || priceHigh === null) {
      const searchFilters = await this.loadLatestSearchFilters(userId, since);

      priceLow = searchFilters?.minPrice ?? null;
      priceHigh = searchFilters?.maxPrice ?? null;
    }

    const padding = RECOMMENDATION_DEFAULTS.PRICE_BAND_PADDING_RATIO;

    return {
      provinceCode: row?.province_code ?? null,
      wardCode: row?.ward_code ?? null,
      priceMin: priceLow !== null ? Math.round(priceLow * (1 - padding)) : null,
      priceMax:
        priceHigh !== null ? Math.round(priceHigh * (1 + padding)) : null,
      behaviorCount: Number(row?.behavior_count ?? 0),
      listingCount: Number(row?.listing_count ?? 0),
    };
  }

  private buildPreferenceSql(): string {
    return `
      WITH weighted AS (
        SELECT
          l.id,
          l.province_code,
          l.ward_code,
          l.price::numeric AS price,
          CASE WHEN b.event_type = $3 THEN $4::int ELSE $5::int END AS weight
        FROM user_behaviors b
        JOIN listings l ON l.id = b.listing_id
        WHERE b.user_id = $1
          AND b.created_at > $2
          AND b.event_type IN ($3, $6)
      )
      SELECT
        (SELECT province_code FROM weighted GROUP BY province_code ORDER BY SUM(weight) DESC LIMIT 1) AS province_code,
        (SELECT ward_code FROM weighted GROUP BY ward_code ORDER BY SUM(weight) DESC LIMIT 1) AS ward_code,
        (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY price) FROM weighted) AS price_low,
        (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY price) FROM weighted) AS price_high,
        (SELECT COUNT(*) FROM weighted) AS behavior_count,
        (SELECT COUNT(DISTINCT id) FROM weighted) AS listing_count
    `;
  }

  private buildPreferenceParameters(userId: string, since: Date): unknown[] {
    return [
      userId,
      since,
      UserBehaviorEventType.FAVORITE,
      BEHAVIOR_WEIGHTS[UserBehaviorEventType.FAVORITE],
      BEHAVIOR_WEIGHTS[UserBehaviorEventType.VIEW],
      UserBehaviorEventType.VIEW,
    ];
  }

  private async loadLatestSearchFilters(
    userId: string,
    since: Date,
  ): Promise<SearchBehaviorFilters | null> {
    const rows: SearchFiltersRow[] = await this.dataSource.query(
      `
        SELECT filters
        FROM user_behaviors
        WHERE user_id = $1
          AND event_type = $2
          AND created_at > $3
          AND filters IS NOT NULL
          AND (filters ? 'minPrice' OR filters ? 'maxPrice')
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId, UserBehaviorEventType.SEARCH, since],
    );

    return rows[0]?.filters ?? null;
  }

  private async loadBehaviorEmbedding(
    userId: string,
    since: Date,
  ): Promise<number[] | null> {
    const rows: EmbeddingRow[] = await this.dataSource.query(
      `
        SELECT AVG(e.embedding)::text AS embedding
        FROM (
          SELECT
            b.listing_id,
            CASE WHEN b.event_type = $3 THEN $4::int ELSE $5::int END AS weight
          FROM user_behaviors b
          WHERE b.user_id = $1
            AND b.created_at > $2
            AND b.event_type IN ($3, $6)
        ) weighted
        JOIN listing_embeddings e ON e.listing_id = weighted.listing_id
        CROSS JOIN LATERAL generate_series(1, weighted.weight)
      `,
      this.buildPreferenceParameters(userId, since),
    );
    const value = rows[0]?.embedding;

    if (!value) return null;

    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'number')
      ? parsed
      : null;
  }

  private async scorePersonalizedCandidates(
    userId: string,
    preference: UserPreference,
    embedding: number[] | null,
  ): Promise<ScoredListing[]> {
    const parameters: unknown[] = [
      ListingStatus.ACTIVE,
      userId,
      [UserBehaviorEventType.VIEW, UserBehaviorEventType.FAVORITE],
      RECOMMENDATION_DEFAULTS.CANDIDATE_POOL_SIZE,
    ];
    const similaritySelect = embedding
      ? `1 - (e.embedding <=> CAST($${parameters.push(`[${embedding.join(',')}]`)} AS vector))`
      : 'NULL';
    const provinceFilter = preference.provinceCode
      ? `AND l.province_code = $${parameters.push(preference.provinceCode)}`
      : '';
    const rows: CandidateRow[] = await this.dataSource.query(
      `
        SELECT
          l.id,
          l.province_code,
          l.ward_code,
          l.price,
          ${similaritySelect} AS similarity
        FROM listings l
        LEFT JOIN listing_embeddings e ON e.listing_id = l.id
        WHERE l.status = $1
          AND l.deleted_at IS NULL
          AND l.owner_id <> $2
          AND NOT EXISTS (
            SELECT 1 FROM user_behaviors b
            WHERE b.user_id = $2
              AND b.listing_id = l.id
              AND b.event_type = ANY($3)
          )
          ${provinceFilter}
        ORDER BY similarity DESC NULLS LAST, l.view_count DESC, l.created_at DESC
        LIMIT $4
      `,
      parameters,
    );
    const weights = embedding
      ? RECOMMENDATION_SCORE_WEIGHTS.WITH_EMBEDDING
      : RECOMMENDATION_SCORE_WEIGHTS.WITHOUT_EMBEDDING;

    return rows
      .map((row) => ({
        listingId: row.id,
        score:
          weights.SIMILARITY * this.scoreSimilarity(row.similarity) +
          weights.AREA * this.scoreArea(row, preference) +
          weights.PRICE * this.scorePrice(Number(row.price), preference),
      }))
      .sort((first, second) => second.score - first.score)
      .slice(0, RECOMMENDATION_DEFAULTS.STORED_RECOMMENDATIONS);
  }

  private async findPopularListings(
    userId: string,
    provinceCode: string | null,
    excludedIds: string[],
    limit: number,
  ): Promise<ScoredListing[]> {
    const listings = await this.queryPopularListings(
      userId,
      provinceCode,
      excludedIds,
      limit,
    );

    if (listings.length >= limit || !provinceCode) return listings;

    const others = await this.queryPopularListings(
      userId,
      null,
      [...excludedIds, ...listings.map((item) => item.listingId)],
      limit - listings.length,
    );

    return [...listings, ...others];
  }

  private async queryPopularListings(
    userId: string,
    provinceCode: string | null,
    excludedIds: string[],
    limit: number,
  ): Promise<ScoredListing[]> {
    const query = this.dataSource
      .createQueryBuilder()
      .select('l.id', 'id')
      .from('listings', 'l')
      .where('l.status = :status', { status: ListingStatus.ACTIVE })
      .andWhere('l.deleted_at IS NULL')
      .andWhere('l.owner_id <> :userId', { userId })
      .orderBy('l.view_count', 'DESC')
      .addOrderBy('l.created_at', 'DESC')
      .limit(limit);

    if (provinceCode) {
      query.andWhere('l.province_code = :provinceCode', { provinceCode });
    }

    if (excludedIds.length > 0) {
      query.andWhere('l.id NOT IN (:...excludedIds)', { excludedIds });
    }

    const rows = await query.getRawMany<{ id: string }>();

    return rows.map((row) => ({ listingId: row.id, score: 0 }));
  }

  private async findUserProvinceCode(userId: string): Promise<string | null> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: { id: true, provinceCode: true },
    });

    return user?.provinceCode ?? null;
  }

  private async findUsersToRefresh(): Promise<string[]> {
    const rows: UserIdRow[] = await this.dataSource.query(
      `
        SELECT DISTINCT user_id FROM user_behaviors WHERE created_at > $1
        UNION
        SELECT user_id FROM user_recommendation_profiles
      `,
      [this.getWindowStart()],
    );

    return rows.map((row) => row.user_id);
  }

  private scoreSimilarity(value: string | null): number {
    if (value === null) return 0;

    return clamp(
      (Number(value) - RECOMMENDATION_DEFAULTS.SIMILARITY_FLOOR) /
        RECOMMENDATION_DEFAULTS.SIMILARITY_RANGE,
    );
  }

  private scoreArea(row: CandidateRow, preference: UserPreference): number {
    if (preference.wardCode && row.ward_code === preference.wardCode) {
      return RECOMMENDATION_DEFAULTS.WARD_MATCH_SCORE;
    }

    if (
      preference.provinceCode &&
      row.province_code === preference.provinceCode
    ) {
      return RECOMMENDATION_DEFAULTS.PROVINCE_MATCH_SCORE;
    }

    return 0;
  }

  private scorePrice(price: number, preference: UserPreference): number {
    if (preference.priceMin === null || preference.priceMax === null) {
      return 0.5;
    }

    if (price >= preference.priceMin && price <= preference.priceMax) return 1;

    const distance =
      price < preference.priceMin
        ? preference.priceMin - price
        : price - preference.priceMax;

    return clamp(1 - distance / Math.max(preference.priceMax, 1));
  }

  private getWindowStart(): Date {
    return new Date(
      Date.now() -
        RECOMMENDATION_DEFAULTS.BEHAVIOR_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
  }
}
