import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUniversities1840000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "universities" (
        "code" varchar(20) NOT NULL,
        "name" varchar(255) NOT NULL,
        CONSTRAINT "PK_universities" PRIMARY KEY ("code")
      );
      CREATE TABLE IF NOT EXISTS "user_universities" (
        "user_id" uuid NOT NULL,
        "university_code" varchar(20) NOT NULL,
        "position" smallint NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_universities" PRIMARY KEY ("user_id", "university_code"),
        CONSTRAINT "FK_user_universities_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_universities_university" FOREIGN KEY ("university_code") REFERENCES "universities"("code") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_user_universities_university"
        ON "user_universities" ("university_code");
      CREATE TABLE IF NOT EXISTS "listing_universities" (
        "listing_id" uuid NOT NULL,
        "university_code" varchar(20) NOT NULL,
        "position" smallint NOT NULL DEFAULT 0,
        CONSTRAINT "PK_listing_universities" PRIMARY KEY ("listing_id", "university_code"),
        CONSTRAINT "FK_listing_universities_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_listing_universities_university" FOREIGN KEY ("university_code") REFERENCES "universities"("code") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_listing_universities_university"
        ON "listing_universities" ("university_code");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "listing_universities";
      DROP TABLE IF EXISTS "user_universities";
      DROP TABLE IF EXISTS "universities";
    `);
  }
}
