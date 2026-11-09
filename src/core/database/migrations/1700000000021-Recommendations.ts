import { MigrationInterface, QueryRunner } from 'typeorm';

export class Recommendations1700000000021 implements MigrationInterface {
  name = 'Recommendations1700000000021';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_behaviors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "event_type" character varying(20) NOT NULL,
        "listing_id" uuid,
        "keyword" character varying(200),
        "filters" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_user_behaviors" PRIMARY KEY ("id"),
        CONSTRAINT "ck_user_behaviors_event_type" CHECK ("event_type" IN ('view', 'favorite', 'search')),
        CONSTRAINT "ck_user_behaviors_target" CHECK (
          ("event_type" = 'search' AND "listing_id" IS NULL)
          OR ("event_type" <> 'search' AND "listing_id" IS NOT NULL)
        ),
        CONSTRAINT "fk_user_behaviors_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_user_behaviors_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_user_behaviors_user_created"
      ON "user_behaviors" ("user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_user_behaviors_listing" ON "user_behaviors" ("listing_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_user_behaviors_favorite"
      ON "user_behaviors" ("user_id", "listing_id")
      WHERE event_type = 'favorite'
    `);
    await queryRunner.query(`
      CREATE TABLE "user_recommendation_profiles" (
        "user_id" uuid NOT NULL,
        "embedding" vector(768),
        "preferred_province_code" character varying(20),
        "preferred_ward_code" character varying(20),
        "price_min" numeric(12,0),
        "price_max" numeric(12,0),
        "behavior_count" integer NOT NULL DEFAULT 0,
        "interacted_listing_count" integer NOT NULL DEFAULT 0,
        "is_fallback" boolean NOT NULL DEFAULT true,
        "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_user_recommendation_profiles" PRIMARY KEY ("user_id"),
        CONSTRAINT "fk_user_recommendation_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "user_recommendations" (
        "user_id" uuid NOT NULL,
        "listing_id" uuid NOT NULL,
        "score" real NOT NULL,
        "rank" smallint NOT NULL,
        "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_user_recommendations" PRIMARY KEY ("user_id", "listing_id"),
        CONSTRAINT "fk_user_recommendations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_user_recommendations_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_user_recommendations_user_rank"
      ON "user_recommendations" ("user_id", "rank")
    `);
    await queryRunner.query(`
      INSERT INTO "user_behaviors" ("user_id", "event_type", "listing_id", "created_at")
      SELECT lv."viewer_id", 'view', lv."listing_id", lv."created_at"
      FROM "listing_views" lv
      JOIN "users" u ON u."id" = lv."viewer_id"
      WHERE u."role_id" = 0
    `);
    await queryRunner.query(`
      INSERT INTO "user_behaviors" ("user_id", "event_type", "listing_id", "created_at")
      SELECT f."user_id", 'favorite', f."listing_id", f."created_at"
      FROM "favorites" f
      JOIN "users" u ON u."id" = f."user_id"
      WHERE u."role_id" = 0
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "user_recommendations"');
    await queryRunner.query(
      'DROP TABLE IF EXISTS "user_recommendation_profiles"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "user_behaviors"');
  }
}
