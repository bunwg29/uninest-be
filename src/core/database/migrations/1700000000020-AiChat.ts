import { MigrationInterface, QueryRunner } from 'typeorm';
import { LISTING_EMBEDDING_INDEX_SQL } from '../vector-search.sql';

export class AiChat1700000000020 implements MigrationInterface {
  name = 'AiChat1700000000020';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "vector"');
    await queryRunner.query(`
      CREATE TABLE "listing_embeddings" (
        "listing_id" uuid NOT NULL,
        "embedding" vector(768) NOT NULL,
        "content_hash" character varying(64) NOT NULL,
        "model" character varying(100) NOT NULL,
        "embedded_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_listing_embeddings" PRIMARY KEY ("listing_id"),
        CONSTRAINT "fk_listing_embeddings_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(LISTING_EMBEDDING_INDEX_SQL);
    await queryRunner.query(`
      CREATE TABLE "ai_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "title" character varying(100) NOT NULL,
        "criteria" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "message_count" integer NOT NULL DEFAULT 0,
        "suggested_listing_count" integer NOT NULL DEFAULT 0,
        "last_message_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_ai_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "fk_ai_conversations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_ai_conversations_user_last_message"
      ON "ai_conversations" ("user_id", "last_message_at")
    `);
    await queryRunner.query(`
      CREATE TABLE "ai_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" character varying(20) NOT NULL,
        "content" text NOT NULL,
        "criteria" jsonb,
        "listing_ids" uuid array NOT NULL DEFAULT '{}',
        "response_type" character varying(20),
        "matched_count" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_ai_messages" PRIMARY KEY ("id"),
        CONSTRAINT "ck_ai_messages_role" CHECK ("role" IN ('user', 'assistant')),
        CONSTRAINT "fk_ai_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_ai_messages_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_ai_messages_conversation_created"
      ON "ai_messages" ("conversation_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_ai_messages_user_created"
      ON "ai_messages" ("user_id", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "ai_messages"');
    await queryRunner.query('DROP TABLE IF EXISTS "ai_conversations"');
    await queryRunner.query('DROP TABLE IF EXISTS "listing_embeddings"');
  }
}
