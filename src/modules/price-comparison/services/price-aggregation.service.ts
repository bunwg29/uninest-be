import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { ListingStatus } from '@modules/listings/entities/listing-status';
import { RoomType } from '@modules/listings/entities/room-type';
import {
  PRICE_COMPARISON_DEFAULTS,
  PriceAggregateAreaLevel,
} from '../constants';

type AdvisoryLockResult = { locked: boolean };

@Injectable()
export class PriceAggregationService {
  private readonly logger = new Logger(PriceAggregationService.name);
  private isRunning = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  @Cron(PRICE_COMPARISON_DEFAULTS.CRON_EXPRESSION, {
    timeZone: PRICE_COMPARISON_DEFAULTS.TIME_ZONE,
  })
  async handleScheduledAggregation(): Promise<number> {
    const enabledValue = this.configService.get<string | boolean>(
      'PRICE_AGGREGATION_ENABLED',
      true,
    );
    const isEnabled = enabledValue !== false && enabledValue !== 'false';

    if (!isEnabled) {
      return 0;
    }

    return this.aggregatePrices();
  }

  async aggregatePrices(): Promise<number> {
    if (this.isRunning) {
      this.logger.warn(
        'Price aggregation skipped because it is already running',
      );

      return 0;
    }

    this.isRunning = true;
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      const lockQueryResult: unknown = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [PRICE_COMPARISON_DEFAULTS.ADVISORY_LOCK_ID],
      );
      const lockResult = this.getRecords(lockQueryResult).filter(
        (record): record is AdvisoryLockResult =>
          typeof record === 'object' &&
          record !== null &&
          'locked' in record &&
          typeof record.locked === 'boolean',
      );

      if (!lockResult[0]?.locked) {
        this.logger.warn(
          'Price aggregation skipped because another instance holds the lock',
        );

        return 0;
      }

      this.logger.log('Price aggregation started');
      await queryRunner.startTransaction();
      const affected = await this.replaceAggregates(queryRunner);

      await queryRunner.commitTransaction();
      this.logger.log(`Price aggregation completed with ${affected} groups`);

      return affected;
    } catch (error: unknown) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      this.logger.error(
        'Price aggregation failed',
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    } finally {
      if (!queryRunner.isReleased) {
        await this.releaseLock(queryRunner);
        await queryRunner.release();
      }

      this.isRunning = false;
    }
  }

  private async replaceAggregates(queryRunner: QueryRunner): Promise<number> {
    const computedAt = new Date();

    await queryRunner.query('DELETE FROM price_aggregates');
    const result: unknown = await queryRunner.query(
      this.buildAggregationSql(),
      [
        ListingStatus.ACTIVE,
        PRICE_COMPARISON_DEFAULTS.MINIMUM_SAMPLE_COUNT,
        computedAt,
        PriceAggregateAreaLevel.PROVINCE,
        PriceAggregateAreaLevel.WARD,
        Object.values(RoomType),
      ],
    );

    return this.getRecords(result).length;
  }

  private buildAggregationSql(): string {
    return `
      WITH room_types AS (
        SELECT unnest($6::varchar[]) AS room_type
      ), valid_listings AS (
        SELECT
          l.province_code,
          l.ward_code,
          l.room_type::text AS room_type,
          l.price::numeric AS price,
          l.created_at
        FROM listings l
        WHERE l.status = $1
          AND l.deleted_at IS NULL
          AND l.price IS NOT NULL
          AND l.price::numeric > 0
      ), grouped AS (
        SELECT
          $4::varchar AS area_level,
          p.code AS area_code,
          p.full_name AS area,
          p.code AS province_code,
          rt.room_type,
          AVG(v.price) AS avg_price,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY v.price) AS popular_price_min,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY v.price) AS popular_price_max,
          COUNT(v.price)::integer AS sample_count,
          MIN(v.created_at) AS data_from
        FROM provinces p
        CROSS JOIN room_types rt
        LEFT JOIN valid_listings v
          ON v.province_code = p.code
          AND v.room_type = rt.room_type
        GROUP BY p.code, p.full_name, rt.room_type
        UNION ALL
        SELECT
          $5::varchar AS area_level,
          w.code AS area_code,
          w.full_name AS area,
          w.province_code,
          rt.room_type,
          AVG(v.price) AS avg_price,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY v.price) AS popular_price_min,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY v.price) AS popular_price_max,
          COUNT(v.price)::integer AS sample_count,
          MIN(v.created_at) AS data_from
        FROM wards w
        CROSS JOIN room_types rt
        LEFT JOIN valid_listings v
          ON v.ward_code = w.code
          AND v.room_type = rt.room_type
        GROUP BY w.code, w.full_name, w.province_code, rt.room_type
      )
      INSERT INTO price_aggregates (
        area_level,
        area_code,
        area,
        province_code,
        room_type,
        avg_price,
        popular_price_min,
        popular_price_max,
        sample_count,
        data_from,
        data_to,
        computed_at
      )
      SELECT
        area_level,
        area_code,
        area,
        province_code,
        room_type,
        CASE WHEN sample_count >= $2 THEN ROUND(avg_price) ELSE NULL END,
        CASE WHEN sample_count >= $2 THEN ROUND(popular_price_min) ELSE NULL END,
        CASE WHEN sample_count >= $2 THEN ROUND(popular_price_max) ELSE NULL END,
        sample_count,
        COALESCE(data_from, $3),
        $3,
        $3
      FROM grouped
      RETURNING id
    `;
  }

  private async releaseLock(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [
        PRICE_COMPARISON_DEFAULTS.ADVISORY_LOCK_ID,
      ]);
    } catch (error: unknown) {
      this.logger.error(
        'Failed to release price aggregation advisory lock',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private getRecords(result: unknown): unknown[] {
    if (Array.isArray(result)) {
      return result;
    }

    if (
      typeof result !== 'object' ||
      result === null ||
      !('records' in result)
    ) {
      return [];
    }

    return Array.isArray(result.records) ? result.records : [];
  }
}
