import { MigrationInterface, QueryRunner } from 'typeorm';

export class PremiumPlans1700000000023 implements MigrationInterface {
  name = 'PremiumPlans1700000000023';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "premium_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(10) NOT NULL,
        "name" varchar(60) NOT NULL,
        "months" smallint NOT NULL,
        "price" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" smallint NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_premium_plans" PRIMARY KEY ("id"),
        CONSTRAINT "uq_premium_plans_code" UNIQUE ("code"),
        CONSTRAINT "chk_premium_plans_price" CHECK ("price" > 0),
        CONSTRAINT "chk_premium_plans_months" CHECK ("months" > 0)
      )
    `);
    await queryRunner.query(`
      INSERT INTO "premium_plans" ("code", "name", "months", "price", "sort_order")
      VALUES
        ('1m', 'Premium 1 tháng', 1, 99000, 1),
        ('3m', 'Premium 3 tháng', 3, 269000, 2),
        ('6m', 'Premium 6 tháng', 6, 499000, 3)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "premium_plans"`);
  }
}
