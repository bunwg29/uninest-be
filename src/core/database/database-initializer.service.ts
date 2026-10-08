import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  KEYWORD_TRIGRAM_INDEXES_SQL,
  UNACCENT_FUNCTION_SQL,
} from './keyword-search.sql';

@Injectable()
export class DatabaseInitializerService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitializerService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.initializeExtensions();
    await this.initializeKeywordSearchIndexes();
    await this.migrateListingsSearchSchema();
    await this.migrateListingsViewingScheduleSchema();
    await this.migrateStorageReferencesToObjectKeys();
    await this.migrateAmenitiesSchema();
  }

  private async migrateListingsSearchSchema() {
    try {
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_listings_location_geography
        ON listings USING GIST ((location::geography))
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_listings_active_created_at
        ON listings (created_at DESC, id)
        WHERE status = 'active' AND deleted_at IS NULL
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Failed to initialize listing search indexes: ${message}`,
      );
    }
  }

  private async migrateStorageReferencesToObjectKeys() {
    try {
      await this.dataSource.query(`
        UPDATE listing_images
        SET url = SUBSTRING(url FROM '(listings/[^?#]+)')
        WHERE url ~ '^https?://.*/listings/'
      `);

      await this.dataSource.query(`
        UPDATE users
        SET avatar_url = SUBSTRING(avatar_url FROM '(avatars/[^?#]+)')
        WHERE avatar_url ~ '^https?://.*/avatars/'
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Failed to migrate legacy storage URLs to object keys: ${message}`,
      );
    }
  }

  private async migrateListingsViewingScheduleSchema() {
    try {
      await this.dataSource.query(`
        ALTER TABLE IF EXISTS listings
        ADD COLUMN IF NOT EXISTS viewing_schedule JSONB
      `);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Failed to update the viewing schedule column: ${message}`,
      );
    }
  }

  private async migrateAmenitiesSchema() {
    try {
      const check = (await this.dataSource.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'amenities' AND column_name = 'id'
      `)) as unknown as { data_type?: string }[];

      if (check.length > 0 && check[0]?.data_type === 'uuid') {
        this.logger.log(
          'Detected legacy amenities table with UUID ids. Converting to numeric ids (smallint)...',
        );

        await this.dataSource.query(`
          DROP TABLE IF EXISTS listing_amenities CASCADE;
          DROP TABLE IF EXISTS amenities CASCADE;

          CREATE TABLE amenities (
            id SMALLINT PRIMARY KEY,
            name VARCHAR(80) NOT NULL UNIQUE,
            "group" SMALLINT NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true
          );

          CREATE TABLE listing_amenities (
            listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
            amenity_id SMALLINT NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (listing_id, amenity_id)
          );
        `);

        this.logger.log(
          'Amenities table converted to numeric ids (smallint) successfully.',
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Failed to check or convert the amenities schema: ${message}`,
      );
    }
  }

  private async initializeKeywordSearchIndexes() {
    try {
      await this.dataSource.query(UNACCENT_FUNCTION_SQL);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to create the unaccent search function: ${message}`,
      );

      return;
    }

    try {
      await this.dataSource.query(KEYWORD_TRIGRAM_INDEXES_SQL);
      this.logger.log('Keyword search trigram indexes are ready.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Trigram indexes are unavailable, keyword search will scan sequentially: ${message}`,
      );
    }
  }

  private async initializeExtensions() {
    const extensions = [
      'uuid-ossp',
      'postgis',
      'vector',
      'unaccent',
      'pg_trgm',
    ];

    for (const ext of extensions) {
      try {
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "${ext}";`);
        this.logger.log(`PostgreSQL extension '${ext}' is active.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `PostgreSQL extension '${ext}' is not installed: ${message}. The application will use fallbacks.`,
        );
      }
    }
  }
}
