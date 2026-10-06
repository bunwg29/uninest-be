import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignSprint2Requirements1770000000000 implements MigrationInterface {
  name = 'AlignSprint2Requirements1770000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "bookings_status_enum" ADD VALUE IF NOT EXISTS 'rejected';
      ALTER TYPE "listings_status_enum" ADD VALUE IF NOT EXISTS 'paused';
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rejected_at" timestamptz;
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_bookings_one_holding_per_listing"
        ON "bookings" ("listing_id")
        WHERE "status" = 'holding' AND "deleted_at" IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "identity_number" varchar(20),
        ADD COLUMN IF NOT EXISTS "landlord_verified_at" timestamptz;
      UPDATE "users" SET "landlord_verified_at" = now()
        WHERE "role_id" = 1 AND "is_verified" = true AND "landlord_verified_at" IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "otp_codes"
        ADD COLUMN IF NOT EXISTS "code_hash" varchar(64),
        ADD COLUMN IF NOT EXISTS "locked_until" timestamptz;
      UPDATE "otp_codes" SET "is_used" = true WHERE "code_hash" IS NULL;
      UPDATE "otp_codes" SET "code_hash" = repeat('0', 64) WHERE "code_hash" IS NULL;
      ALTER TABLE "otp_codes" ALTER COLUMN "code_hash" SET NOT NULL;
      ALTER TABLE "otp_codes" DROP COLUMN IF EXISTS "code";
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listing_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "listing_id" uuid NOT NULL,
        "reporter_id" uuid NOT NULL,
        "reason" varchar(30) NOT NULL,
        "note" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_listing_reports" PRIMARY KEY ("id"),
        CONSTRAINT "uq_listing_reports_listing_reporter" UNIQUE ("listing_id", "reporter_id"),
        CONSTRAINT "FK_listing_reports_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_listing_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_listing_reports_listing" ON "listing_reports" ("listing_id");
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
        DROP COLUMN IF EXISTS "edited_at",
        DROP COLUMN IF EXISTS "original_content";
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "listing_reports";
      DROP INDEX IF EXISTS "uq_bookings_one_holding_per_listing";
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "rejected_at";
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "identity_number",
        DROP COLUMN IF EXISTS "landlord_verified_at";
      ALTER TABLE "otp_codes" DROP COLUMN IF EXISTS "locked_until";
    `);
  }
}
