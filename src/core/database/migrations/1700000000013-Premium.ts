import { MigrationInterface, QueryRunner } from 'typeorm';

export class Premium1700000000013 implements MigrationInterface {
  name = 'Premium1700000000013';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "is_premium" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "premium_expires_at" timestamptz`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_premium" ON "users" ("is_premium", "premium_expires_at") WHERE "is_premium" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "listing_views" ADD COLUMN "source" varchar(20) NOT NULL DEFAULT 'other'`,
    );
    await queryRunner.query(`
      CREATE TABLE "premium_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "plan_code" varchar(10) NOT NULL,
        "months" smallint NOT NULL,
        "amount" integer NOT NULL,
        "reference_code" varchar(30) NOT NULL,
        "status" varchar(10) NOT NULL DEFAULT 'pending',
        "gateway_transaction_id" varchar(64),
        "paid_at" timestamptz,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_premium_orders" PRIMARY KEY ("id"),
        CONSTRAINT "uq_premium_orders_reference" UNIQUE ("reference_code"),
        CONSTRAINT "uq_premium_orders_gateway_tx" UNIQUE ("gateway_transaction_id"),
        CONSTRAINT "chk_premium_orders_status" CHECK ("status" IN ('pending', 'paid', 'expired')),
        CONSTRAINT "fk_premium_orders_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_premium_orders_user_created" ON "premium_orders" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_premium_orders_pending" ON "premium_orders" ("expires_at") WHERE "status" = 'pending'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "premium_orders"`);
    await queryRunner.query(`ALTER TABLE "listing_views" DROP COLUMN "source"`);
    await queryRunner.query(`DROP INDEX "idx_users_premium"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "premium_expires_at"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_premium"`);
  }
}
