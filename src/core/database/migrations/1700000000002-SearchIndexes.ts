import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  KEYWORD_TRIGRAM_INDEXES_SQL,
  LISTING_SEARCH_INDEXES_SQL,
  UNACCENT_FUNCTION_SQL,
} from '../keyword-search.sql';

export class SearchIndexes1700000000002 implements MigrationInterface {
  name = 'SearchIndexes1700000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(LISTING_SEARCH_INDEXES_SQL);
    await queryRunner.query(UNACCENT_FUNCTION_SQL);
    await queryRunner.query(KEYWORD_TRIGRAM_INDEXES_SQL);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listings_full_address_trgm";
      DROP INDEX IF EXISTS "idx_listings_title_trgm";
      DROP INDEX IF EXISTS "idx_listings_location_geography";
      DROP FUNCTION IF EXISTS uninest_unaccent(text);
    `);
  }
}
