import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

export const MIGRATIONS_GLOB = path.join(__dirname, 'migrations', '*.{ts,js}');

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'uninest_db',
  entities: [path.join(__dirname, '../../modules/**/entities/*.{ts,js}')],
  migrations: [MIGRATIONS_GLOB],
  migrationsTableName: 'migrations',
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
});
