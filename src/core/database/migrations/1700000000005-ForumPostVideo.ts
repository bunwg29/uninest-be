import { MigrationInterface, QueryRunner } from 'typeorm';

export class ForumPostVideo1700000000005 implements MigrationInterface {
  name = 'ForumPostVideo1700000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "video_key" character varying(255)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "forum_posts" DROP COLUMN IF EXISTS "video_key"',
    );
  }
}
