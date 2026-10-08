import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateListingViews1790000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listing_views" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "listing_id" uuid NOT NULL,
        "viewer_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_listing_views" PRIMARY KEY ("id"),
        CONSTRAINT "FK_listing_views_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_listing_views_listing_created" ON "listing_views" ("listing_id", "created_at");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "listing_views"');
  }
}
