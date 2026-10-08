import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropRedundantFavoriteUnique1700000000003 implements MigrationInterface {
  name = 'DropRedundantFavoriteUnique1700000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "favorites" DROP CONSTRAINT IF EXISTS "uq_favorites_user_listing"',
    );
  }

  async down(): Promise<void> {}
}
