import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatByLandlord1700000000022 implements MigrationInterface {
  name = 'ChatByLandlord1700000000022';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" ADD COLUMN "listing_id" uuid`,
    );
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD CONSTRAINT "fk_messages_listing" FOREIGN KEY ("listing_id")
      REFERENCES "listings"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_messages_listing" ON "messages" ("listing_id")
      WHERE "listing_id" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "messages" m SET "listing_id" = c."listing_id"
      FROM "conversations" c
      WHERE m."conversation_id" = c."id"
        AND c."deleted_at" IS NULL
        AND m."id" = (
          SELECT first_message."id" FROM "messages" first_message
          WHERE first_message."conversation_id" = c."id"
          ORDER BY first_message."created_at", first_message."id"
          LIMIT 1
        )
    `);
    await queryRunner.query(`
      CREATE TEMP TABLE "conversation_merge" ON COMMIT DROP AS
      SELECT "id" AS "old_id",
             FIRST_VALUE("id") OVER (
               PARTITION BY "student_id", "landlord_id"
               ORDER BY COALESCE("last_message_at", "created_at") DESC, "created_at" DESC, "id"
             ) AS "keep_id"
      FROM "conversations"
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "messages" m SET "conversation_id" = cm."keep_id"
      FROM "conversation_merge" cm
      WHERE m."conversation_id" = cm."old_id" AND cm."old_id" <> cm."keep_id"
    `);
    await queryRunner.query(`
      UPDATE "conversations" c SET
        "last_message_at" = merged."last_message_at",
        "student_deleted_at" = merged."student_deleted_at",
        "landlord_deleted_at" = merged."landlord_deleted_at"
      FROM (
        SELECT cm."keep_id",
               MAX(source."last_message_at") AS "last_message_at",
               CASE WHEN COUNT(*) FILTER (WHERE source."student_deleted_at" IS NULL) > 0
                    THEN NULL ELSE MAX(source."student_deleted_at") END AS "student_deleted_at",
               CASE WHEN COUNT(*) FILTER (WHERE source."landlord_deleted_at" IS NULL) > 0
                    THEN NULL ELSE MAX(source."landlord_deleted_at") END AS "landlord_deleted_at"
        FROM "conversation_merge" cm
        INNER JOIN "conversations" source ON source."id" = cm."old_id"
        GROUP BY cm."keep_id"
        HAVING COUNT(*) > 1
      ) merged
      WHERE c."id" = merged."keep_id"
    `);
    await queryRunner.query(`
      DELETE FROM "conversations" c USING "conversation_merge" cm
      WHERE c."id" = cm."old_id" AND cm."old_id" <> cm."keep_id"
    `);
    await queryRunner.query(
      `DROP INDEX "public"."uq_conversations_listing_student"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_conversations_student_landlord"
      ON "conversations" ("student_id", "landlord_id")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations" DROP CONSTRAINT "FK_c14948d6807e84b810dd4bed949"
    `);
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "listing_id" DROP NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD CONSTRAINT "fk_conversations_listing" FOREIGN KEY ("listing_id")
      REFERENCES "listings"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."uq_conversations_student_landlord"`,
    );
    await queryRunner.query(`
      CREATE TEMP TABLE "message_context" ON COMMIT DROP AS
      SELECT m."id" AS "message_id",
             m."conversation_id",
             (
               SELECT earlier."listing_id" FROM "messages" earlier
               WHERE earlier."conversation_id" = m."conversation_id"
                 AND earlier."listing_id" IS NOT NULL
                 AND (earlier."created_at", earlier."id") <= (m."created_at", m."id")
               ORDER BY earlier."created_at" DESC, earlier."id" DESC
               LIMIT 1
             ) AS "context_listing_id"
      FROM "messages" m
    `);
    await queryRunner.query(`
      UPDATE "conversations" c SET "listing_id" = (
        SELECT mc."context_listing_id" FROM "message_context" mc
        WHERE mc."conversation_id" = c."id" AND mc."context_listing_id" IS NOT NULL
        ORDER BY mc."message_id" DESC LIMIT 1
      )
      WHERE c."listing_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE TEMP TABLE "conversation_split" ON COMMIT DROP AS
      SELECT d."old_id", d."listing_id", uuid_generate_v4() AS "new_id"
      FROM (
        SELECT DISTINCT mc."conversation_id" AS "old_id",
               mc."context_listing_id" AS "listing_id"
        FROM "message_context" mc
        INNER JOIN "conversations" c ON c."id" = mc."conversation_id"
        WHERE mc."context_listing_id" IS NOT NULL
          AND mc."context_listing_id" IS DISTINCT FROM c."listing_id"
      ) d
    `);
    await queryRunner.query(`
      INSERT INTO "conversations"
        ("id", "listing_id", "student_id", "landlord_id", "last_message_at",
         "student_deleted_at", "landlord_deleted_at", "created_at", "updated_at")
      SELECT cs."new_id", cs."listing_id", c."student_id", c."landlord_id",
             (
               SELECT MAX(m."created_at") FROM "messages" m
               INNER JOIN "message_context" mc ON mc."message_id" = m."id"
               WHERE mc."conversation_id" = cs."old_id"
                 AND mc."context_listing_id" = cs."listing_id"
             ),
             c."student_deleted_at", c."landlord_deleted_at", c."created_at", now()
      FROM "conversation_split" cs
      INNER JOIN "conversations" c ON c."id" = cs."old_id"
    `);
    await queryRunner.query(`
      UPDATE "messages" m SET "conversation_id" = cs."new_id"
      FROM "message_context" mc
      INNER JOIN "conversation_split" cs
        ON cs."old_id" = mc."conversation_id" AND cs."listing_id" = mc."context_listing_id"
      WHERE m."id" = mc."message_id"
    `);
    await queryRunner.query(`
      UPDATE "conversations" c SET "last_message_at" = (
        SELECT MAX(m."created_at") FROM "messages" m WHERE m."conversation_id" = c."id"
      )
      WHERE c."id" IN (SELECT "old_id" FROM "conversation_split")
    `);
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "fk_conversations_listing"`,
    );
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD CONSTRAINT "FK_c14948d6807e84b810dd4bed949" FOREIGN KEY ("listing_id")
      REFERENCES "listings"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_conversations_listing_student"
      ON "conversations" ("listing_id", "student_id")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM "conversations" WHERE "listing_id" IS NULL) THEN
          ALTER TABLE "conversations" ALTER COLUMN "listing_id" SET NOT NULL;
        END IF;
      END
      $$
    `);
    await queryRunner.query(`DROP INDEX "public"."idx_messages_listing"`);
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "fk_messages_listing"`,
    );
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "listing_id"`);
  }
}
