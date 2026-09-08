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
import { seedRbac } from './rbac.seeder';
import { seedLocations } from './locations.seeder';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SEEDERS: Record<
  string,
  { name: string; description: string; fn: (ds: DataSource) => Promise<void> }
> = {
  rbac: {
    name: 'RBAC Seeder',
    description:
      'Nạp vai trò (0: Student, 1: Landlord, 2: Admin) và bảng permissions',
    fn: seedRbac,
  },
  locations: {
    name: 'Locations Seeder',
    description: 'Nạp 34 tỉnh/thành phố và 3.321 phường/xã từ dataset VN units',
    fn: seedLocations,
  },
};

async function run() {
  const arg = process.argv[2]?.trim().toLowerCase();

  if (!arg) {
    console.log('\n[Seeder CLI] Thieu ten seeder can chay.');
    console.log('\nCach dung:');
    console.log('   npm run seed -- <ten_seeder>');
    console.log('   (Vi du: npm run seed -- rbac)');
    console.log('\nDanh sach cac seeders co san:');

    for (const [key, item] of Object.entries(SEEDERS)) {
      console.log(`   - ${key}: ${item.name} (${item.description})`);
    }

    process.exit(1);
  }

  const cleanKey = arg.replace(/\.seeder(\.ts)?$/, '');
  const seeder = SEEDERS[cleanKey];

  if (!seeder) {
    console.log(`\n[Seeder CLI] Khong tim thay seeder: "${arg}"`);
    console.log('Cac seeder hop le: ' + Object.keys(SEEDERS).join(', '));
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
    database: process.env.DB_DATABASE || 'uninest',
    entities: [
      Role,
      Permission,
      RolePermission,
      User,
      RefreshToken,
      OtpCode,
      Province,
      Ward,
    ],
    synchronize: isSync,
    namingStrategy: new SnakeNamingStrategy(),
  });

  try {
    console.log(
      `\n[Seeder CLI] Dang ket noi database ${process.env.DB_DATABASE || 'uninest'}...`,
    );
    await dataSource.initialize();
    console.log(`[Seeder CLI] Bat dau chay ${seeder.name}...`);

    await seeder.fn(dataSource);

    console.log(`[Seeder CLI] Hoan thanh thanh cong!\n`);
  } catch (error) {
    console.error('[Seeder CLI] Loi trong qua trinh seed:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void run();
