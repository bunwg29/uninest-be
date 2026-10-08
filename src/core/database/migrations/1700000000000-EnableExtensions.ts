import { MigrationInterface, QueryRunner } from 'typeorm';

const REQUIRED_EXTENSIONS = ['uuid-ossp', 'postgis', 'unaccent', 'pg_trgm'];

export class EnableExtensions1700000000000 implements MigrationInterface {
  name = 'EnableExtensions1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const extension of REQUIRED_EXTENSIONS) {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
          CREATE EXTENSION IF NOT EXISTS "vector";
        END IF;
      END
      $$;
    `);
  }

  async down(): Promise<void> {}
}
