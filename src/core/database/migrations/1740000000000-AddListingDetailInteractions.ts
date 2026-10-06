import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddListingDetailInteractions1740000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        user_id UUID NOT NULL,
        listing_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT pk_favorites PRIMARY KEY (user_id, listing_id),
        CONSTRAINT uq_favorites_user_listing UNIQUE (user_id, listing_id),
        CONSTRAINT fk_favorites_user FOREIGN KEY (user_id)
          REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_favorites_listing FOREIGN KEY (listing_id)
          REFERENCES listings(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_favorites_listing_id
      ON favorites(listing_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS favorites');
    await queryRunner.query(
      'ALTER TABLE listings DROP COLUMN IF EXISTS view_count',
    );
  }
}
