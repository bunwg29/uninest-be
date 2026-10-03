import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseInitializerService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitializerService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.initializeExtensions();
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
        `Không thể khởi tạo index tìm kiếm tin đăng: ${message}`,
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
        `Không thể chuyển URL storage cũ sang object key: ${message}`,
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

      this.logger.warn(`Không thể cập nhật cột lịch xem phòng: ${message}`);
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
          'Phát hiện bảng amenities dùng id UUID cũ. Đang tự động chuyển đổi sang kiểu số (smallint)...',
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
          'Đã chuyển đổi cấu trúc bảng amenities sang kiểu số (smallint) thành công.',
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Lỗi khi kiểm tra/chuyển đổi schema amenities: ${message}`,
      );
    }
  }

  private async initializeExtensions() {
    const extensions = ['uuid-ossp', 'postgis', 'vector', 'unaccent'];

    for (const ext of extensions) {
      try {
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "${ext}";`);
        this.logger.log(`Extension PostgreSQL '${ext}' đang hoạt động.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `Extension PostgreSQL '${ext}' chưa được cài đặt: ${message}. Ứng dụng sẽ dùng phương án dự phòng.`,
        );
      }
    }
  }
}
