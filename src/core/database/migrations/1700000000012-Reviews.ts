import { MigrationInterface, QueryRunner } from 'typeorm';

export class Reviews1700000000012 implements MigrationInterface {
  name = 'Reviews1700000000012';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "listings" ADD COLUMN "average_rating" numeric(3,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD COLUMN "review_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TYPE "reports_entity_type_enum" ADD VALUE IF NOT EXISTS 'review'`,
    );
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "listing_id" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "location_rating" smallint NOT NULL,
        "value_rating" smallint NOT NULL,
        "landlord_rating" smallint NOT NULL,
        "amenities_rating" smallint NOT NULL,
        "average_rating" numeric(3,2) NOT NULL,
        "comment" text,
        "edited_until" timestamptz NOT NULL,
        "landlord_reply" text,
        "replied_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "chk_reviews_location_rating" CHECK ("location_rating" BETWEEN 1 AND 5),
        CONSTRAINT "chk_reviews_value_rating" CHECK ("value_rating" BETWEEN 1 AND 5),
        CONSTRAINT "chk_reviews_landlord_rating" CHECK ("landlord_rating" BETWEEN 1 AND 5),
        CONSTRAINT "chk_reviews_amenities_rating" CHECK ("amenities_rating" BETWEEN 1 AND 5),
        CONSTRAINT "fk_reviews_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_reviews_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_reviews_student" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_reviews_student_listing" ON "reviews" ("student_id", "listing_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_reviews_booking" ON "reviews" ("booking_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reviews_listing_created" ON "reviews" ("listing_id", "created_at" DESC) WHERE "deleted_at" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "reports" WHERE "entity_type" = 'review'`,
    );
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(
      `ALTER TABLE "listings" DROP COLUMN "review_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" DROP COLUMN "average_rating"`,
    );
    await queryRunner.query(
      `ALTER TYPE "reports_entity_type_enum" RENAME TO "reports_entity_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "reports_entity_type_enum" AS ENUM ('listing', 'forum_post', 'forum_comment', 'user')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "entity_type" TYPE "reports_entity_type_enum" USING "entity_type"::text::"reports_entity_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "reports_entity_type_enum_old"`);
  }
}
