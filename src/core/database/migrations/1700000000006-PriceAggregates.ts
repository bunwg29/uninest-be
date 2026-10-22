import { MigrationInterface, QueryRunner } from 'typeorm';

export class PriceAggregates1700000000006 implements MigrationInterface {
  name = 'PriceAggregates1700000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "price_aggregates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "area_level" character varying(20) NOT NULL,
        "area_code" character varying(20) NOT NULL,
        "area" character varying(150) NOT NULL,
        "province_code" character varying(20) NOT NULL,
        "room_type" character varying(50) NOT NULL,
        "avg_price" numeric(12,0),
        "popular_price_min" numeric(12,0),
        "popular_price_max" numeric(12,0),
        "sample_count" integer NOT NULL,
        "data_from" TIMESTAMP WITH TIME ZONE NOT NULL,
        "data_to" TIMESTAMP WITH TIME ZONE NOT NULL,
        "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_price_aggregates" PRIMARY KEY ("id"),
        CONSTRAINT "ck_price_aggregates_area_level" CHECK ("area_level" IN ('province', 'ward')),
        CONSTRAINT "ck_price_aggregates_sample_count" CHECK ("sample_count" >= 0),
        CONSTRAINT "ck_price_aggregates_prices" CHECK (
          ("sample_count" < 5 AND "avg_price" IS NULL AND "popular_price_min" IS NULL AND "popular_price_max" IS NULL)
          OR
          ("sample_count" >= 5 AND "avg_price" IS NOT NULL AND "popular_price_min" IS NOT NULL AND "popular_price_max" IS NOT NULL)
        ),
        CONSTRAINT "fk_price_aggregates_province" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_price_aggregates_area_room_type"
      ON "price_aggregates" ("area_level", "area_code", "room_type")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_price_aggregates_province_room_type"
      ON "price_aggregates" ("province_code", "room_type")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_price_aggregates_computed_at"
      ON "price_aggregates" ("computed_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "price_aggregates"');
  }
}
