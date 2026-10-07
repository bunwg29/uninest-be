import { DataSource } from 'typeorm';
import { UserRoleType, ROLE_NAMES, ROLE_CODES } from '@common/constants';
import {
  Role,
  Permission,
  RolePermission,
} from '../../../modules/users/entities';

export async function seedRbac(dataSource: DataSource): Promise<void> {
  const roleRepo = dataSource.getRepository(Role);
  const permissionRepo = dataSource.getRepository(Permission);
  const rolePermissionRepo = dataSource.getRepository(RolePermission);

  console.log('[RBAC seeder] Seeding roles and permissions...');

  const rolesToSeed: {
    id: UserRoleType;
    code: string;
    name: string;
    description: string;
  }[] = [
    {
      id: UserRoleType.STUDENT,
      code: ROLE_CODES[UserRoleType.STUDENT],
      name: ROLE_NAMES[UserRoleType.STUDENT],
      description: 'Sinh viên tìm kiếm phòng trọ và đặt lịch hẹn xem phòng',
    },
    {
      id: UserRoleType.LANDLORD,
      code: ROLE_CODES[UserRoleType.LANDLORD],
      name: ROLE_NAMES[UserRoleType.LANDLORD],
      description: 'Chủ nhà trọ đăng tin, quản lý phòng và duyệt lịch hẹn',
    },
    {
      id: UserRoleType.ADMIN,
      code: ROLE_CODES[UserRoleType.ADMIN],
      name: ROLE_NAMES[UserRoleType.ADMIN],
      description: 'Quản trị viên hệ thống có toàn quyền quản lý',
    },
  ];

  for (const r of rolesToSeed) {
    const existing = await roleRepo.findOne({ where: { id: r.id } });

    if (!existing) {
      await roleRepo.save(roleRepo.create(r));
      console.log(`   + Role created: [${r.id}] ${r.code} - ${r.name}`);
    }
  }

  const permissionsToSeed: {
    code: string;
    name: string;
    module: string;
    description: string;
  }[] = [
    {
      code: 'users:me',
      name: 'Xem thông tin tài khoản bản thân',
      module: 'users',
      description: 'Xem thông tin chi tiết tài khoản đang đăng nhập',
    },
    {
      code: 'users:update-profile',
      name: 'Cập nhật hồ sơ cá nhân',
      module: 'users',
      description: 'Chỉnh sửa họ tên, ảnh đại diện, thông tin liên hệ',
    },
    {
      code: 'users:read',
      name: 'Xem hồ sơ người dùng khác',
      module: 'users',
      description: 'Xem thông tin công khai của chủ trọ hoặc người cùng phòng',
    },
    {
      code: 'users:manage',
      name: 'Quản lý toàn bộ người dùng',
      module: 'users',
      description: 'Khoá/Mở khoá tài khoản, quản trị danh sách người dùng',
    },
    {
      code: 'listings:read',
      name: 'Xem danh sách và chi tiết phòng trọ',
      module: 'listings',
      description: 'Tìm kiếm, lọc và xem thông tin chi tiết phòng trọ',
    },
    {
      code: 'listings:create',
      name: 'Đăng tin phòng trọ mới',
      module: 'listings',
      description: 'Tạo bài đăng cho thuê phòng trọ mới',
    },
    {
      code: 'listings:update',
      name: 'Chỉnh sửa tin phòng trọ của mình',
      module: 'listings',
      description: 'Cập nhật giá, tiện ích, ảnh và mô tả phòng trọ',
    },
    {
      code: 'listings:delete',
      name: 'Xoá hoặc ẩn tin phòng trọ',
      module: 'listings',
      description: 'Xoá hoặc ẩn tin đăng cho thuê phòng trọ',
    },
    {
      code: 'listings:approve',
      name: 'Duyệt hoặc từ chối tin đăng phòng trọ',
      module: 'listings',
      description:
        'Kiểm duyệt chất lượng tin đăng trước khi hiển thị công khai',
    },
    {
      code: 'bookings:create',
      name: 'Đặt lịch hẹn xem phòng',
      module: 'bookings',
      description: 'Gửi yêu cầu đặt lịch xem phòng trọ đến chủ trọ',
    },
    {
      code: 'bookings:read',
      name: 'Xem danh sách lịch hẹn',
      module: 'bookings',
      description: 'Xem lịch hẹn đã gửi hoặc đã nhận',
    },
    {
      code: 'bookings:manage',
      name: 'Xử lý lịch hẹn xem phòng',
      module: 'bookings',
      description: 'Phê duyệt, từ chối hoặc đổi thời gian lịch hẹn xem phòng',
    },
    {
      code: 'reviews:create',
      name: 'Đánh giá phòng trọ',
      module: 'reviews',
      description: 'Viết đánh giá và chấm điểm sao cho phòng trọ',
    },
    {
      code: 'reviews:read',
      name: 'Xem đánh giá phòng trọ',
      module: 'reviews',
      description: 'Xem các nhận xét, đánh giá của cộng đồng',
    },
    {
      code: 'admin:access',
      name: 'Truy cập trang quản trị Admin',
      module: 'admin',
      description: 'Quyền đăng nhập vào trang điều hành hệ thống',
    },
    {
      code: 'roles:manage',
      name: 'Phân quyền và quản lý vai trò',
      module: 'admin',
      description: 'Tuỳ chỉnh permissions cho các roles trên hệ thống web',
    },
  ];

  const permissionMap = new Map<string, Permission>();

  for (const p of permissionsToSeed) {
    let perm = await permissionRepo.findOne({ where: { code: p.code } });

    if (!perm) {
      perm = await permissionRepo.save(permissionRepo.create(p));
      console.log(`   + Permission created: ${p.code} (${p.name})`);
    }

    permissionMap.set(p.code, perm);
  }

  const rolePermissionsMap: Record<UserRoleType, string[]> = {
    [UserRoleType.STUDENT]: [
      'users:me',
      'users:update-profile',
      'users:read',
      'listings:read',
      'bookings:create',
      'bookings:read',
      'reviews:create',
      'reviews:read',
    ],
    [UserRoleType.LANDLORD]: [
      'users:me',
      'users:update-profile',
      'users:read',
      'listings:read',
      'listings:create',
      'listings:update',
      'listings:delete',
      'bookings:read',
      'bookings:manage',
      'reviews:read',
    ],
    [UserRoleType.ADMIN]: permissionsToSeed.map((p) => p.code),
  };

  for (const [roleIdStr, permCodes] of Object.entries(rolePermissionsMap)) {
    const roleId = Number(roleIdStr);

    for (const code of permCodes) {
      const perm = permissionMap.get(code);

      if (!perm) continue;

      const existing = await rolePermissionRepo.findOne({
        where: { roleId, permissionId: perm.id },
      });

      if (!existing) {
        await rolePermissionRepo.save(
          rolePermissionRepo.create({
            roleId,
            permissionId: perm.id,
          }),
        );
      }
    }

    console.log(
      `   [OK] Role [${roleId}] configured with ${permCodes.length} permissions`,
    );
  }

  console.log('[RBAC seeder] Roles and permissions seeded!');
}
