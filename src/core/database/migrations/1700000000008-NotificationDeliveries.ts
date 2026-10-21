import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationDeliveries1700000000008 implements MigrationInterface {
  name = 'NotificationDeliveries1700000000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "notification_id" uuid NOT NULL, "token" character varying(512) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "ticket_id" character varying(100), "ticketed_at" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT 0, "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lease_until" TIMESTAMP WITH TIME ZONE, "last_error" character varying(80), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "pk_notification_deliveries" PRIMARY KEY ("id"), CONSTRAINT "fk_notification_deliveries_notification" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_notification_deliveries_notification_token" ON "notification_deliveries" ("notification_id", "token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notification_deliveries_due" ON "notification_deliveries" ("status", "next_attempt_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_deliveries"`);
  }
}
