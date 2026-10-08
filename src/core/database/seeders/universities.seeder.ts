import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { University } from '../../../modules/universities/entities';

export async function seedUniversities(dataSource: DataSource): Promise<void> {
  const filePath = path.resolve(__dirname, 'data', 'universities.json');
  const universities = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    code: string;
    name: string;
  }[];

  console.log(
    `[Universities seeder] Seeding ${universities.length} universities...`,
  );

  await dataSource
    .getRepository(University)
    .upsert(universities, { conflictPaths: ['code'] });

  console.log('[Universities seeder] Universities are up to date.');
}
