import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForumViewsAndCommentIndexes1820000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "forum_post_views" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "post_id" uuid NOT NULL,
        "viewer_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_forum_post_views" PRIMARY KEY ("id"),
        CONSTRAINT "FK_forum_post_views_post" FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_forum_post_views_post_viewer_created"
        ON "forum_post_views" ("post_id", "viewer_id", "created_at");
      CREATE INDEX IF NOT EXISTS "idx_forum_comments_parent_created"
        ON "forum_comments" ("parent_id", "created_at");
      CREATE INDEX IF NOT EXISTS "idx_listing_views_listing_viewer_created"
        ON "listing_views" ("listing_id", "viewer_id", "created_at");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listing_views_listing_viewer_created";
      DROP INDEX IF EXISTS "idx_forum_comments_parent_created";
      DROP TABLE IF EXISTS "forum_post_views";
    `);
  }
}
