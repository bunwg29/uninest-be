import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddListingVideoKey1810000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "video_key" varchar(255)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "listings" DROP COLUMN IF EXISTS "video_key"',
    );
  }
}
