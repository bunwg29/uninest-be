import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookings1760000000000 implements MigrationInterface {
  name = 'CreateBookings1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM ('pending', 'confirmed', 'holding', 'expired', 'cancelled');
      CREATE TABLE "bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(50) NOT NULL,
        "listing_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "phone" character varying(10) NOT NULL,
        "start_time" timestamptz NOT NULL,
        "end_time" timestamptz NOT NULL,
        "status" "bookings_status_enum" NOT NULL DEFAULT 'pending',
        "expires_at" timestamptz,
        "note" text,
        "cancel_reason" text,
        "deposit_amount" numeric(12,0),
        "confirmed_at" timestamptz,
        "expired_at" timestamptz,
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bookings_code" UNIQUE ("code"),
        CONSTRAINT "CHK_bookings_time" CHECK ("start_time" < "end_time"),
        CONSTRAINT "FK_bookings_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_bookings_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );
      CREATE TABLE "booking_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "event_type" character varying(50) NOT NULL,
        "actor" character varying(20),
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_booking_events_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE
      );
      CREATE INDEX "idx_bookings_listing_time" ON "bookings" ("listing_id", "start_time", "end_time");
      CREATE INDEX "idx_bookings_status_expires" ON "bookings" ("status", "expires_at");
      CREATE INDEX "idx_bookings_user_status" ON "bookings" ("user_id", "status");
      CREATE INDEX "idx_booking_events_booking" ON "booking_events" ("booking_id", "created_at");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "booking_events";
      DROP TABLE IF EXISTS "bookings";
      DROP TYPE IF EXISTS "bookings_status_enum";
    `);
  }
}
