import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ListingStatus } from '@modules/listings/entities/listing-status';
import { RoomType } from '@modules/listings/entities/room-type';
import { AI_EMBEDDING_DEFAULTS, ROOM_TYPE_LABELS } from '../constants';
import { ListingEmbedding } from '../entities';
import { AiProviderService } from './ai-provider.service';

interface PendingListingRow {
  id: string;
  title: string;
  description: string | null;
  room_type: RoomType;
  price: string;
  area: string;
  max_occupants: number;
  full_address: string;
  amenities: string | null;
  universities: string | null;
  content_hash: string | null;
}

interface AdvisoryLockRow {
  locked: boolean;
}

@Injectable()
export class ListingEmbeddingService {
  private readonly logger = new Logger(ListingEmbeddingService.name);
  private isRunning = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly aiProviderService: AiProviderService,
  ) {}

  @Cron(AI_EMBEDDING_DEFAULTS.CRON_EXPRESSION, {
    timeZone: AI_EMBEDDING_DEFAULTS.TIME_ZONE,
  })
  async handleScheduledEmbedding(): Promise<number> {
    const enabledValue = this.configService.get<string | boolean>(
      'AI_EMBEDDING_ENABLED',
      true,
    );
    const isEnabled = enabledValue !== false && enabledValue !== 'false';

    if (!isEnabled || !this.aiProviderService.isConfigured()) {
      return 0;
    }

    return this.embedPendingListings();
  }

  async embedPendingListings(): Promise<number> {
    if (this.isRunning) {
      this.logger.warn(
        'Listing embedding skipped because it is already running',
      );

      return 0;
    }

    this.isRunning = true;
    const queryRunner = this.dataSource.createQueryRunner();
    let embedded = 0;

    try {
      await queryRunner.connect();
      const lockRows: unknown = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [AI_EMBEDDING_DEFAULTS.ADVISORY_LOCK_ID],
      );

      if (!this.isLockAcquired(lockRows)) {
        this.logger.warn(
          'Listing embedding skipped because another instance holds the lock',
        );

        return 0;
      }

      try {
        for (
          let batch = 0;
          batch < AI_EMBEDDING_DEFAULTS.MAX_BATCHES_PER_RUN;
          batch += 1
        ) {
          const processed = await this.embedNextBatch();

          embedded += processed.embedded;

          if (processed.scanned < AI_EMBEDDING_DEFAULTS.BATCH_SIZE) break;
        }
      } finally {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [
          AI_EMBEDDING_DEFAULTS.ADVISORY_LOCK_ID,
        ]);
      }

      if (embedded > 0) {
        this.logger.log(
          `Listing embedding completed with ${embedded} listings`,
        );
      }

      return embedded;
    } catch (error: unknown) {
      this.logger.error(
        'Listing embedding failed',
        error instanceof Error ? error.stack : undefined,
      );

      return embedded;
    } finally {
      await queryRunner.release();
      this.isRunning = false;
    }
  }

  private async embedNextBatch(): Promise<{
    scanned: number;
    embedded: number;
  }> {
    const rows: PendingListingRow[] = await this.dataSource.query(
      `
        SELECT
          l.id,
          l.title,
          l.description,
          l.room_type,
          l.price,
          l.area,
          l.max_occupants,
          l.full_address,
          (
            SELECT string_agg(a.name, ', ' ORDER BY a.id)
            FROM listing_amenities la
            JOIN amenities a ON a.id = la.amenity_id
            WHERE la.listing_id = l.id
          ) AS amenities,
          (
            SELECT string_agg(u.name, ', ' ORDER BY lu.position)
            FROM listing_universities lu
            JOIN universities u ON u.code = lu.university_code
            WHERE lu.listing_id = l.id
          ) AS universities,
          e.content_hash
        FROM listings l
        LEFT JOIN listing_embeddings e ON e.listing_id = l.id
        WHERE l.status = $1
          AND l.deleted_at IS NULL
          AND (e.listing_id IS NULL OR l.updated_at > e.embedded_at)
        ORDER BY l.updated_at ASC
        LIMIT $2
      `,
      [ListingStatus.ACTIVE, AI_EMBEDDING_DEFAULTS.BATCH_SIZE],
    );

    if (rows.length === 0) return { scanned: 0, embedded: 0 };

    const documents = rows.map((row) => {
      const content = this.buildDocument(row);

      return {
        row,
        content,
        contentHash: createHash('sha256').update(content).digest('hex'),
      };
    });
    const unchanged = documents.filter(
      (item) => item.row.content_hash === item.contentHash,
    );
    const changed = documents.filter(
      (item) => item.row.content_hash !== item.contentHash,
    );
    const now = new Date();
    const repository = this.dataSource.getRepository(ListingEmbedding);

    if (unchanged.length > 0) {
      await repository.update(
        unchanged.map((item) => item.row.id),
        { embeddedAt: now },
      );
    }

    if (changed.length === 0) {
      return { scanned: rows.length, embedded: 0 };
    }

    const embeddings = await this.aiProviderService.createEmbeddings(
      changed.map((item) => item.content),
    );
    const model = this.aiProviderService.getEmbeddingModel();

    await repository.upsert(
      changed.map((item, index) => ({
        listingId: item.row.id,
        embedding: embeddings[index],
        contentHash: item.contentHash,
        model,
        embeddedAt: now,
      })),
      ['listingId'],
    );

    return { scanned: rows.length, embedded: changed.length };
  }

  private isLockAcquired(rows: unknown): boolean {
    if (!Array.isArray(rows)) return false;

    const firstRow: unknown = rows[0];

    return (
      typeof firstRow === 'object' &&
      firstRow !== null &&
      'locked' in firstRow &&
      (firstRow as AdvisoryLockRow).locked === true
    );
  }

  private buildDocument(row: PendingListingRow): string {
    return [
      row.title,
      `Loại phòng: ${ROOM_TYPE_LABELS[row.room_type]}`,
      `Giá thuê: ${Number(row.price).toLocaleString('vi-VN')}đ/tháng`,
      `Diện tích: ${Number(row.area)} m²`,
      `Số người ở tối đa: ${row.max_occupants}`,
      `Địa chỉ: ${row.full_address}`,
      row.amenities ? `Tiện ích: ${row.amenities}` : null,
      row.universities ? `Gần trường: ${row.universities}` : null,
      row.description
        ? row.description.slice(0, AI_EMBEDDING_DEFAULTS.DESCRIPTION_MAX_LENGTH)
        : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join('\n');
  }
}
