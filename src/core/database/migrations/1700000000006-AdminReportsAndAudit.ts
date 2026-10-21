import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminReportsAndAudit1700000000006 implements MigrationInterface {
  name = 'AdminReportsAndAudit1700000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "listings" ADD COLUMN "rejection_reason" character varying(500)`,
    );
    await queryRunner.query(
      `CREATE TYPE "reports_entity_type_enum" AS ENUM ('listing', 'forum_post', 'forum_comment', 'user')`,
    );
    await queryRunner.query(
      `CREATE TYPE "reports_status_enum" AS ENUM ('pending', 'resolved', 'dismissed')`,
    );
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reporter_id" uuid NOT NULL,
        "entity_type" "reports_entity_type_enum" NOT NULL,
        "entity_id" uuid NOT NULL,
        "reason" character varying(80) NOT NULL,
        "note" character varying(500),
        "status" "reports_status_enum" NOT NULL DEFAULT 'pending',
        "resolved_by" uuid,
        "resolution_reason" character varying(500),
        "resolved_at" timestamp with time zone,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "pk_reports" PRIMARY KEY ("id"),
        CONSTRAINT "fk_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_reports_resolver" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_reports_reporter_entity" ON "reports" ("reporter_id", "entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_status_created" ON "reports" ("status", "created_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_id" uuid NOT NULL,
        "action" character varying(80) NOT NULL,
        "entity_type" character varying(40) NOT NULL,
        "entity_id" uuid NOT NULL,
        "reason" character varying(500) NOT NULL,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_audit_logs_actor" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_created" ON "audit_logs" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" ("actor_id", "created_at")`,
    );
    await queryRunner.query(`
      INSERT INTO "reports" ("reporter_id", "entity_type", "entity_id", "reason", "note", "created_at", "updated_at")
      SELECT "reporter_id", 'listing', "listing_id", "reason"::text, "note", "created_at", "created_at"
      FROM "listing_reports"
      ON CONFLICT ("reporter_id", "entity_type", "entity_id") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "reports" ("reporter_id", "entity_type", "entity_id", "reason", "note", "status", "created_at", "updated_at")
      SELECT "reporter_id", CASE "target_type"::text WHEN 'post' THEN 'forum_post' ELSE 'forum_comment' END::"reports_entity_type_enum",
        "target_id", "reason"::text, "note", CASE WHEN "is_resolved" THEN 'resolved' ELSE 'pending' END::"reports_status_enum",
        "created_at", "created_at"
      FROM "forum_reports"
      ON CONFLICT ("reporter_id", "entity_type", "entity_id") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TYPE "reports_status_enum"`);
    await queryRunner.query(`DROP TYPE "reports_entity_type_enum"`);
    await queryRunner.query(
      `ALTER TABLE "listings" DROP COLUMN "rejection_reason"`,
    );
  }
}
