import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { ROLE_CODES, ROLE_NAMES, UserRoleType } from '@common/constants';
import { Amenity, AmenityGroup } from '@modules/listings/entities';
import { Province, Ward } from '@modules/locations/entities';
import { University } from '@modules/universities/entities';
import { Permission, Role, RolePermission } from '@modules/users/entities';

interface AdministrativeUnit {
  code: string;
  name: string;
  fullName: string;
  codeName: string;
  wards: Omit<Ward, 'provinceCode' | 'province'>[];
}

const WARD_BATCH_SIZE = 500;

const ROLE_DESCRIPTIONS: Record<UserRoleType, string> = {
  [UserRoleType.STUDENT]:
    'Sinh viên tìm kiếm phòng trọ và đặt lịch hẹn xem phòng',
  [UserRoleType.LANDLORD]:
    'Chủ nhà trọ đăng tin, quản lý phòng và duyệt lịch hẹn',
  [UserRoleType.ADMIN]: 'Quản trị viên hệ thống có toàn quyền quản lý',
};

const PERMISSIONS: readonly (readonly [string, string, UserRoleType[]])[] = [
  [
    'users:me',
    'Xem thông tin tài khoản bản thân',
    [UserRoleType.STUDENT, UserRoleType.LANDLORD],
  ],
  [
    'users:update-profile',
    'Cập nhật hồ sơ cá nhân',
    [UserRoleType.STUDENT, UserRoleType.LANDLORD],
  ],
  [
    'users:read',
    'Xem hồ sơ người dùng khác',
    [UserRoleType.STUDENT, UserRoleType.LANDLORD],
  ],
  ['users:manage', 'Quản lý toàn bộ người dùng', []],
  [
    'listings:read',
    'Xem danh sách và chi tiết phòng trọ',
    [UserRoleType.STUDENT, UserRoleType.LANDLORD],
  ],
  ['listings:create', 'Đăng tin phòng trọ mới', [UserRoleType.LANDLORD]],
  [
    'listings:update',
    'Chỉnh sửa tin phòng trọ của mình',
    [UserRoleType.LANDLORD],
  ],
  ['listings:delete', 'Xoá hoặc ẩn tin phòng trọ', [UserRoleType.LANDLORD]],
  ['listings:approve', 'Duyệt hoặc từ chối tin đăng phòng trọ', []],
  ['bookings:create', 'Đặt lịch hẹn xem phòng', [UserRoleType.STUDENT]],
  [
    'bookings:read',
    'Xem danh sách lịch hẹn',
    [UserRoleType.STUDENT, UserRoleType.LANDLORD],
  ],
  ['bookings:manage', 'Xử lý lịch hẹn xem phòng', [UserRoleType.LANDLORD]],
  ['reviews:create', 'Đánh giá phòng trọ', [UserRoleType.STUDENT]],
  [
    'reviews:read',
    'Xem đánh giá phòng trọ',
    [UserRoleType.STUDENT, UserRoleType.LANDLORD],
  ],
  ['admin:access', 'Truy cập trang quản trị', []],
  ['roles:manage', 'Phân quyền và quản lý vai trò', []],
];

const AMENITIES: readonly (readonly [number, string, AmenityGroup])[] = [
  [1, 'Điều hòa', AmenityGroup.FURNITURE],
  [2, 'Tủ lạnh', AmenityGroup.FURNITURE],
  [3, 'Máy giặt chung', AmenityGroup.FURNITURE],
  [4, 'Gác lửng', AmenityGroup.FURNITURE],
  [5, 'Nội thất cơ bản', AmenityGroup.FURNITURE],
  [6, 'WiFi miễn phí', AmenityGroup.FACILITY],
  [7, 'Chỗ để xe', AmenityGroup.FACILITY],
  [8, 'Bếp chung', AmenityGroup.FACILITY],
  [9, 'Sân phơi', AmenityGroup.FACILITY],
  [10, 'Ban công', AmenityGroup.FACILITY],
  [11, 'Camera an ninh', AmenityGroup.SECURITY],
  [12, 'Bảo vệ 24/7', AmenityGroup.SECURITY],
  [13, 'Khóa cửa điện tử', AmenityGroup.SECURITY],
  [14, 'WC riêng', AmenityGroup.ROOM_FEATURE],
  [15, 'Cửa sổ lớn', AmenityGroup.ROOM_FEATURE],
  [16, 'Thang máy', AmenityGroup.ROOM_FEATURE],
  [17, 'Máy nước nóng', AmenityGroup.FURNITURE],
];

const readData = <T>(fileName: string): T =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'data', fileName), 'utf8'),
  ) as T;

async function seedRolesAndPermissions(dataSource: DataSource): Promise<void> {
  const roles = Object.values(UserRoleType)
    .filter((value): value is UserRoleType => typeof value === 'number')
    .map((id) => ({
      id,
      code: ROLE_CODES[id],
      name: ROLE_NAMES[id],
      description: ROLE_DESCRIPTIONS[id],
    }));

  await dataSource.getRepository(Role).upsert(roles, ['id']);

  const permissionRepository = dataSource.getRepository(Permission);

  await permissionRepository.upsert(
    PERMISSIONS.map(([code, name]) => ({
      code,
      name,
      module: code.split(':')[0],
      description: name,
    })),
    ['code'],
  );

  const permissionIds = new Map(
    (await permissionRepository.find()).map((item) => [item.code, item.id]),
  );
  const rolePermissions = PERMISSIONS.flatMap(([code, , roleIds]) => {
    const permissionId = permissionIds.get(code);

    return permissionId === undefined
      ? []
      : [...roleIds, UserRoleType.ADMIN].map((roleId) => ({
          roleId,
          permissionId,
        }));
  });

  await dataSource
    .getRepository(RolePermission)
    .upsert(rolePermissions, ['roleId', 'permissionId']);

  console.log(
    `[Catalog] ${roles.length} roles, ${PERMISSIONS.length} permissions`,
  );
}

async function seedAmenities(dataSource: DataSource): Promise<void> {
  await dataSource.getRepository(Amenity).upsert(
    AMENITIES.map(([id, name, group]) => ({ id, name, group, isActive: true })),
    ['id'],
  );

  console.log(`[Catalog] ${AMENITIES.length} amenities`);
}

async function seedAdministrativeUnits(dataSource: DataSource): Promise<void> {
  const units = readData<AdministrativeUnit[]>('administrative-units.json');
  const wards = units.flatMap(({ code, wards: items }) =>
    items.map((ward) => ({ ...ward, provinceCode: code })),
  );

  await dataSource.getRepository(Province).upsert(
    units.map(({ code, name, fullName, codeName }) => ({
      code,
      name,
      fullName,
      codeName,
    })),
    ['code'],
  );

  for (let index = 0; index < wards.length; index += WARD_BATCH_SIZE) {
    await dataSource
      .getRepository(Ward)
      .upsert(wards.slice(index, index + WARD_BATCH_SIZE), ['code']);
  }

  console.log(`[Catalog] ${units.length} provinces, ${wards.length} wards`);
}

async function seedUniversities(dataSource: DataSource): Promise<void> {
  const universities = readData<University[]>('universities.json');

  await dataSource
    .getRepository(University)
    .upsert(universities, { conflictPaths: ['code'] });

  console.log(`[Catalog] ${universities.length} universities`);
}

export async function seedCatalog(dataSource: DataSource): Promise<void> {
  await seedRolesAndPermissions(dataSource);
  await seedAmenities(dataSource);
  await seedAdministrativeUnits(dataSource);
  await seedUniversities(dataSource);
}
