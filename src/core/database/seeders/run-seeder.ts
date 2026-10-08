import dataSource from '../data-source';
import { seedCatalog } from './catalog.seeder';
import { seedDemo } from './demo.seeder';

const DEFAULT_BULK_COUNT = 5000;

const USAGE = `
Usage:
  npm run seed                     catalog + demo data
  npm run seed -- catalog          roles, amenities, provinces/wards, universities only
  npm run seed -- --bulk[=N]       catalog + demo data + N extra listings (default ${DEFAULT_BULK_COUNT})
`;

const parseArguments = (args: string[]) => {
  const bulkArgument = args.find((arg) => arg.startsWith('--bulk'));
  const bulkValue = Number(bulkArgument?.split('=')[1]);

  return {
    isCatalogOnly: args.includes('catalog'),
    isHelp: args.includes('--help'),
    bulkCount: bulkArgument ? bulkValue || DEFAULT_BULK_COUNT : 0,
  };
};

async function run(): Promise<void> {
  const { isCatalogOnly, isHelp, bulkCount } = parseArguments(
    process.argv.slice(2),
  );

  if (isHelp) {
    console.log(USAGE);

    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeding is disabled in production');
  }

  await dataSource.initialize();

  try {
    if (process.env.DB_SYNCHRONIZE === 'true') {
      await dataSource.synchronize();
    } else {
      await dataSource.runMigrations();
    }

    await seedCatalog(dataSource);

    if (!isCatalogOnly) {
      await seedDemo(dataSource, bulkCount);
    }

    console.log('[Seed] Done');
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error('[Seed] Failed:', error);
  process.exit(1);
});
