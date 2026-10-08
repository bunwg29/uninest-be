import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropComparisonItems1800000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "comparison_items"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "comparison_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "listing_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comparison_items" PRIMARY KEY ("id"),
        CONSTRAINT "uq_comparison_items_user_listing" UNIQUE ("user_id", "listing_id"),
        CONSTRAINT "FK_comparison_items_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comparison_items_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_comparison_items_user_id" ON "comparison_items" ("user_id");
      CREATE INDEX IF NOT EXISTS "idx_comparison_items_listing_id" ON "comparison_items" ("listing_id");
    `);
  }
}
