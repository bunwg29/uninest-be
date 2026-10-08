import { MigrationInterface, QueryRunner } from 'typeorm';
import { KEYWORD_SEARCH_SQL } from '../keyword-search.sql';

export class AddKeywordSearchTrigramIndexes1830000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
    await queryRunner.query(KEYWORD_SEARCH_SQL);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listings_full_address_trgm";
      DROP INDEX IF EXISTS "idx_listings_title_trgm";
    `);
  }
}
