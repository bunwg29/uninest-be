import { MigrationInterface, QueryRunner } from 'typeorm';

export class ListingModeration1700000000010 implements MigrationInterface {
  name = 'ListingModeration1700000000010';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "listings" ADD COLUMN "moderation_hidden_at" TIMESTAMP WITH TIME ZONE',
    );
    await queryRunner.query(
      'ALTER TABLE "listings" ADD COLUMN "moderation_reason" character varying(500)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "listings" DROP COLUMN "moderation_reason"',
    );
    await queryRunner.query(
      'ALTER TABLE "listings" DROP COLUMN "moderation_hidden_at"',
    );
  }
}
