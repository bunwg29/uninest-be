import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { seedRbac } from './rbac.seeder';
import { seedLocations } from './locations.seeder';
import { seedAmenities } from './amenities.seeder';
import { seedRooms } from './rooms.seeder';
import { seedChatDemo } from './chat-demo.seeder';
import { seedDaNang } from './danang.seeder';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

async function seedDaNangWithDependencies(
  dataSource: DataSource,
): Promise<void> {
  await seedRbac(dataSource);
  await seedAmenities(dataSource);
  await seedLocations(dataSource).catch((error: unknown) => {
    console.warn(
      `[Locations seeder] Skipped due to error: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  await seedDaNang(dataSource);
}

async function seedRoomsWithDependencies(
  dataSource: DataSource,
): Promise<void> {
  await seedRbac(dataSource);
  await seedAmenities(dataSource);
  await seedLocations(dataSource);
  await seedRooms(dataSource);
}

const SEEDERS: Record<
  string,
  { name: string; description: string; fn: (ds: DataSource) => Promise<void> }
> = {
  rbac: {
    name: 'Seeder phân quyền',
    description:
      'Nạp vai trò (0: Sinh viên, 1: Chủ trọ, 2: Quản trị viên) và danh sách quyền',
    fn: seedRbac,
  },
  amenities: {
    name: 'Seeder tiện ích',
    description:
      'Nạp danh mục tiện ích với mã số (1..17) và nhóm số (0: Nội thất, 1: Tiện ích, 2: An ninh, 3: Phòng)',
    fn: seedAmenities,
  },
  locations: {
    name: 'Seeder địa giới',
    description:
      'Nạp 34 tỉnh/thành phố và 3.321 phường/xã từ dữ liệu đơn vị hành chính Việt Nam',
    fn: seedLocations,
  },
  chat: {
    name: 'Seeder dữ liệu thử chat',
    description:
      'Nạp 1 chủ trọ, 1 sinh viên, 1 tin đăng active và 1 hội thoại mẫu để thử chức năng nhắn tin',
    fn: seedChatDemo,
  },
  danang: {
    name: 'Seeder tin đăng Đà Nẵng',
    description:
      'Nạp tin đăng quanh các trường đại học tại Đà Nẵng (đủ 4 trạng thái), tài khoản 3 vai trò; thêm --bulk[=N] để sinh khối lượng lớn (mặc định 5.000 tin)',
    fn: seedDaNangWithDependencies,
  },
  rooms: {
    name: 'Seeder 55 phòng trọ',
    description:
      'Nạp dữ liệu phân quyền, tiện ích, địa giới, tài khoản mẫu và 55 phòng trọ',
    fn: seedRoomsWithDependencies,
  },
};

async function run() {
  const arg = process.argv[2]?.trim().toLowerCase();

  if (!arg) {
    console.log('\n[Seeder runner] Missing the name of the seeder to run.');
    console.log('\nUsage:');
    console.log('   npm run seed -- <seeder_name>');
    console.log('   (Example: npm run seed -- rooms)');
    console.log('\nAvailable seeders:');

    for (const [key, item] of Object.entries(SEEDERS)) {
      console.log(`   - ${key}: ${item.name} (${item.description})`);
    }

    process.exit(1);
  }

  const cleanKey = arg.replace(/\.seeder(\.ts)?$/, '');
  const seeder = SEEDERS[cleanKey];

  if (!seeder) {
    console.log(`\n[Seeder runner] Seeder not found: "${arg}"`);
    console.log('Valid seeders: ' + Object.keys(SEEDERS).join(', '));
    process.exit(1);
  }

  const isSync =
    process.env.DB_SYNCHRONIZE === 'true' || process.env.DB_SYNCHRONIZE === '1';

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'uninest_db',
    entities: [
      path.resolve(__dirname, '../../../modules/**/entities/*.{ts,js}'),
    ],
    synchronize: isSync,
    namingStrategy: new SnakeNamingStrategy(),
  });

  try {
    console.log(
      `\n[Seeder runner] Connecting to database ${process.env.DB_DATABASE || 'uninest_db'}...`,
    );
    await dataSource.initialize();
    console.log(`[Seeder runner] Running ${seeder.name}...`);

    await seeder.fn(dataSource);

    console.log('[Seeder runner] Completed successfully!\n');
  } catch (error) {
    console.error('[Seeder runner] Seeding failed:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void run();
