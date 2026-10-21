import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifications1700000000006 implements MigrationInterface {
  name = 'Notifications1700000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "notifications_type_enum" AS ENUM ('listing', 'message', 'reminder', 'system', 'booking', 'payment', 'forum')`,
    );
    await queryRunner.query(
      `CREATE TYPE "push_devices_platform_enum" AS ENUM ('android', 'ios')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "event_key" character varying(160) NOT NULL, "type" "notifications_type_enum" NOT NULL, "title" character varying(180) NOT NULL, "body" text NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_notifications_event_key" UNIQUE ("event_key"), CONSTRAINT "pk_notifications" PRIMARY KEY ("id"), CONSTRAINT "fk_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_created" ON "notifications" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_unread" ON "notifications" ("user_id", "created_at") WHERE "read_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_preferences" ("user_id" uuid NOT NULL, "new_listings" boolean NOT NULL DEFAULT true, "messages" boolean NOT NULL DEFAULT true, "reminders" boolean NOT NULL DEFAULT true, "system" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "pk_notification_preferences" PRIMARY KEY ("user_id"), CONSTRAINT "fk_notification_preferences_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE TABLE "push_devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token" character varying(512) NOT NULL, "platform" "push_devices_platform_enum" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_push_devices_token" UNIQUE ("token"), CONSTRAINT "pk_push_devices" PRIMARY KEY ("id"), CONSTRAINT "fk_push_devices_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_push_devices_user" ON "push_devices" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "saved_searches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "criteria" jsonb NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "pk_saved_searches" PRIMARY KEY ("id"), CONSTRAINT "fk_saved_searches_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_saved_searches_user" ON "saved_searches" ("user_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "saved_searches"`);
    await queryRunner.query(`DROP TABLE "push_devices"`);
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "push_devices_platform_enum"`);
    await queryRunner.query(`DROP TYPE "notifications_type_enum"`);
  }
}
