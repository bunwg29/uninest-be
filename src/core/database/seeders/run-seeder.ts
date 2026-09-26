import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import {
  Role,
  Permission,
  RolePermission,
  User,
} from '../../../modules/users/entities';
import { RefreshToken, OtpCode } from '../../../modules/auth/entities';
import { Province, Ward } from '../../../modules/locations/entities';
import {
  Amenity,
  Listing,
  ListingAmenity,
  ListingImage,
} from '../../../modules/listings/entities';
import { seedRbac } from './rbac.seeder';
import { seedLocations } from './locations.seeder';
import { seedAmenities } from './amenities.seeder';
import { seedRooms } from './rooms.seeder';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

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
  rooms: {
    name: 'Seeder 55 phòng trọ',
    description:
      'Nạp dữ liệu phân quyền, tiện ích, địa giới, 5 chủ trọ và 55 phòng trọ mẫu',
    fn: seedRoomsWithDependencies,
  },
};

async function run() {
  const arg = process.argv[2]?.trim().toLowerCase();

  if (!arg) {
    console.log('\n[Trình nạp dữ liệu] Thiếu tên seeder cần chạy.');
    console.log('\nCách dùng:');
    console.log('   npm run seed -- <ten_seeder>');
    console.log('   (Ví dụ: npm run seed -- rooms)');
    console.log('\nDanh sách các seeder có sẵn:');

    for (const [key, item] of Object.entries(SEEDERS)) {
      console.log(`   - ${key}: ${item.name} (${item.description})`);
    }

    process.exit(1);
  }

  const cleanKey = arg.replace(/\.seeder(\.ts)?$/, '');
  const seeder = SEEDERS[cleanKey];

  if (!seeder) {
    console.log(`\n[Trình nạp dữ liệu] Không tìm thấy seeder: "${arg}"`);
    console.log('Các seeder hợp lệ: ' + Object.keys(SEEDERS).join(', '));
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
      Role,
      Permission,
      RolePermission,
      User,
      RefreshToken,
      OtpCode,
      Province,
      Ward,
      Amenity,
      Listing,
      ListingAmenity,
      ListingImage,
    ],
    synchronize: isSync,
    namingStrategy: new SnakeNamingStrategy(),
  });

  try {
    console.log(
      `\n[Trình nạp dữ liệu] Đang kết nối cơ sở dữ liệu ${process.env.DB_DATABASE || 'uninest_db'}...`,
    );
    await dataSource.initialize();
    console.log(`[Trình nạp dữ liệu] Bắt đầu chạy ${seeder.name}...`);

    await seeder.fn(dataSource);

    console.log('[Trình nạp dữ liệu] Hoàn thành thành công!\n');
  } catch (error) {
    console.error('[Trình nạp dữ liệu] Lỗi trong quá trình nạp:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void run();
