import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { DataSource, DeepPartial, In } from 'typeorm';
import { UserRoleType } from '@common/constants';
import { Conversation, Message, MessageType } from '@modules/chat/entities';
import {
  Listing,
  ListingAmenity,
  ListingImage,
  ListingStatus,
  ListingUniversity,
  RoomType,
} from '@modules/listings/entities';
import { User } from '@modules/users/entities';

export const DEMO_PASSWORD = 'UniNest@123';

const DA_NANG_PROVINCE_CODE = '48';
const DA_NANG_PROVINCE_NAME = 'Thành phố Đà Nẵng';
const BASE_LISTING_COUNT = 64;
const INSERT_BATCH_SIZE = 250;
const PASSWORD_HASH_ROUNDS = 10;
const COORDINATE_JITTER_DEGREES = 0.004;
const IMAGES_PER_LISTING = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

interface DemoAccount {
  phone: string;
  fullName: string;
  roleId: UserRoleType;
  isLandlordVerified?: boolean;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    phone: '0900000001',
    fullName: 'Sinh viên UniNest',
    roleId: UserRoleType.STUDENT,
  },
  {
    phone: '0900000211',
    fullName: 'Sinh viên Bách khoa',
    roleId: UserRoleType.STUDENT,
  },
  {
    phone: '0900000212',
    fullName: 'Sinh viên Kinh tế',
    roleId: UserRoleType.STUDENT,
  },
  {
    phone: '0900000201',
    fullName: 'Nguyễn Văn Hùng',
    roleId: UserRoleType.LANDLORD,
    isLandlordVerified: true,
  },
  {
    phone: '0900000202',
    fullName: 'Trần Thị Mai',
    roleId: UserRoleType.LANDLORD,
    isLandlordVerified: true,
  },
  {
    phone: '0900000203',
    fullName: 'Lê Quang Vinh',
    roleId: UserRoleType.LANDLORD,
    isLandlordVerified: true,
  },
  {
    phone: '0900000204',
    fullName: 'Phạm Thanh Tùng',
    roleId: UserRoleType.LANDLORD,
    isLandlordVerified: true,
  },
  {
    phone: '0900000205',
    fullName: 'Võ Thị Lan (chờ xác minh)',
    roleId: UserRoleType.LANDLORD,
    isLandlordVerified: false,
  },
  {
    phone: '0900000299',
    fullName: 'Quản trị viên UniNest',
    roleId: UserRoleType.ADMIN,
  },
];

interface Area {
  wardCode: string;
  wardName: string;
  latitude: number;
  longitude: number;
  nearbySchool: string;
  universityCodes: string[];
}

const AREAS: readonly Area[] = [
  {
    wardCode: '20200',
    wardName: 'Phường Hoà Khánh',
    latitude: 16.0739,
    longitude: 108.1499,
    nearbySchool: 'ĐH Bách khoa Đà Nẵng',
    universityCodes: ['DDK', 'DDS'],
  },
  {
    wardCode: '20197',
    wardName: 'Phường Liên Chiểu',
    latitude: 16.0617,
    longitude: 108.1585,
    nearbySchool: 'ĐH Sư phạm Đà Nẵng',
    universityCodes: ['DDS', 'DDK'],
  },
  {
    wardCode: '20285',
    wardName: 'Phường Ngũ Hành Sơn',
    latitude: 15.9757,
    longitude: 108.2531,
    nearbySchool: 'ĐH CNTT & TT Việt - Hàn (VKU)',
    universityCodes: ['VKU'],
  },
  {
    wardCode: '20285',
    wardName: 'Phường Ngũ Hành Sơn',
    latitude: 16.0481,
    longitude: 108.2402,
    nearbySchool: 'ĐH Kinh tế Đà Nẵng',
    universityCodes: ['DDQ'],
  },
  {
    wardCode: '20242',
    wardName: 'Phường Hải Châu',
    latitude: 16.0678,
    longitude: 108.2208,
    nearbySchool: 'ĐH Kinh tế Đà Nẵng',
    universityCodes: ['DDQ'],
  },
  {
    wardCode: '20209',
    wardName: 'Phường Thanh Khê',
    latitude: 16.068,
    longitude: 108.19,
    nearbySchool: 'ĐH Sư phạm Đà Nẵng',
    universityCodes: ['DDS'],
  },
  {
    wardCode: '20263',
    wardName: 'Phường Sơn Trà',
    latitude: 16.085,
    longitude: 108.243,
    nearbySchool: 'ĐH Kinh tế Đà Nẵng',
    universityCodes: ['DDQ'],
  },
  {
    wardCode: '20260',
    wardName: 'Phường Cẩm Lệ',
    latitude: 16.015,
    longitude: 108.2,
    nearbySchool: 'ĐH CNTT & TT Việt - Hàn (VKU)',
    universityCodes: ['VKU'],
  },
];

interface RoomTypeSpec {
  code: RoomType;
  label: string;
  minPrice: number;
  maxPrice: number;
  minArea: number;
  maxArea: number;
  maxOccupants: number;
}

const ROOM_TYPES: readonly RoomTypeSpec[] = [
  {
    code: RoomType.PHONG_TRO,
    label: 'Phòng trọ',
    minPrice: 1_200_000,
    maxPrice: 2_200_000,
    minArea: 14,
    maxArea: 24,
    maxOccupants: 2,
  },
  {
    code: RoomType.CHUNG_CU_MINI,
    label: 'Chung cư mini',
    minPrice: 2_500_000,
    maxPrice: 4_200_000,
    minArea: 22,
    maxArea: 35,
    maxOccupants: 3,
  },
  {
    code: RoomType.STUDIO,
    label: 'Studio',
    minPrice: 3_000_000,
    maxPrice: 4_800_000,
    minArea: 25,
    maxArea: 38,
    maxOccupants: 2,
  },
  {
    code: RoomType.KY_TUC_XA,
    label: 'Ký túc xá',
    minPrice: 800_000,
    maxPrice: 1_400_000,
    minArea: 16,
    maxArea: 28,
    maxOccupants: 4,
  },
  {
    code: RoomType.NHA_NGUYEN_CAN,
    label: 'Nhà nguyên căn',
    minPrice: 5_500_000,
    maxPrice: 9_000_000,
    minArea: 45,
    maxArea: 80,
    maxOccupants: 6,
  },
];

const STREETS = [
  'Nguyễn Lương Bằng',
  'Tôn Đức Thắng',
  'Ngô Sĩ Liên',
  'Hoàng Văn Thái',
  'Trần Đại Nghĩa',
  'Lê Văn Hiến',
  'Nguyễn Văn Linh',
  'Hà Huy Tập',
  'Điện Biên Phủ',
  'Phan Đăng Lưu',
];

const AMENITY_POOL = [1, 2, 3, 6, 7, 8, 10, 11, 14, 17];

const PHOTO_IDS = [
  'photo-1579632151052-92f741fb9b79',
  'photo-1570570665905-346e1b6be193',
  'photo-1552189864-e05b02af1697',
  'photo-1543607875-4d92312234c5',
  'photo-1560448075-57d0285fc59b',
  'photo-1612320743558-020669ff20e8',
  'photo-1616486338812-3dadae4b4ace',
  'photo-1616594039964-ae9021a400a0',
  'photo-1618221195710-dd6b41faaea6',
  'photo-1505693416388-ac5ce068fe85',
  'photo-1615874959474-d609969a20ed',
  'photo-1522708323590-d24dbb6b0267',
];

const DEMO_CHAT = [
  { fromStudent: true, content: 'Dạ chào anh, phòng này còn trống không ạ?' },
  { fromStudent: false, content: 'Còn em nhé. Phòng ở được 2 bạn.' },
  {
    fromStudent: false,
    content: 'Điện 3.500đ/kWh, nước 80k/người/tháng, cọc 1 tháng.',
  },
] as const;

const createRandom = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const createStableId = (key: string): string => {
  const hex = createHash('md5').update(key).digest('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const pickStatus = (index: number, isBulk: boolean): ListingStatus => {
  const bucket = index % 20;

  if (isBulk)
    return bucket === 19 ? ListingStatus.HIDDEN : ListingStatus.ACTIVE;

  if (bucket === 16) return ListingStatus.PENDING;

  if (bucket === 17) return ListingStatus.HIDDEN;

  if (bucket === 18) return ListingStatus.REJECTED;

  return ListingStatus.ACTIVE;
};

async function seedAccounts(
  dataSource: DataSource,
): Promise<Map<string, User>> {
  const repository = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, PASSWORD_HASH_ROUNDS);
  const users = new Map<string, User>();

  for (const account of DEMO_ACCOUNTS) {
    const existing = await repository.findOneBy({ phone: account.phone });
    const data: Partial<User> = {
      phone: account.phone,
      email: existing?.email ?? `${account.phone}@uninest.local`,
      fullName: account.fullName,
      roleId: account.roleId,
      passwordHash,
      isActive: true,
      isVerified: true,
      phoneVerified: true,
      landlordVerifiedAt: account.isLandlordVerified ? new Date() : null,
    };

    users.set(
      account.phone,
      await repository.save(
        existing ? repository.merge(existing, data) : repository.create(data),
      ),
    );
  }

  console.log(
    `[Demo] ${DEMO_ACCOUNTS.length} accounts (password ${DEMO_PASSWORD})`,
  );

  return users;
}

async function seedListings(
  dataSource: DataSource,
  owners: User[],
  total: number,
  keyPrefix: string,
  isBulk: boolean,
): Promise<number> {
  let created = 0;

  for (let offset = 0; offset < total; offset += INSERT_BATCH_SIZE) {
    const indexes = Array.from(
      { length: Math.min(INSERT_BATCH_SIZE, total - offset) },
      (_, position) => offset + position,
    );
    const ids = indexes.map((index) => createStableId(`${keyPrefix}-${index}`));
    const existingIds = new Set(
      (
        await dataSource.getRepository(Listing).find({
          select: { id: true },
          where: { id: In(ids) },
          withDeleted: true,
        })
      ).map((listing) => listing.id),
    );
    const listings: DeepPartial<Listing>[] = [];
    const images: DeepPartial<ListingImage>[] = [];
    const amenities: DeepPartial<ListingAmenity>[] = [];
    const universities: Pick<
      ListingUniversity,
      'listingId' | 'universityCode' | 'position'
    >[] = [];

    indexes.forEach((index, position) => {
      const id = ids[position];
      const area = AREAS[index % AREAS.length];

      area.universityCodes.forEach((universityCode, order) =>
        universities.push({ listingId: id, universityCode, position: order }),
      );

      if (existingIds.has(id)) return;

      const random = createRandom(index * 7919 + (isBulk ? 17 : 3));
      const roomType = ROOM_TYPES[Math.floor(random() * ROOM_TYPES.length)];
      const streetAddress = `${1 + Math.floor(random() * 220)} ${STREETS[Math.floor(random() * STREETS.length)]}`;
      const price =
        Math.round(
          (roomType.minPrice +
            random() * (roomType.maxPrice - roomType.minPrice)) /
            100_000,
        ) * 100_000;
      const size = Math.round(
        roomType.minArea + random() * (roomType.maxArea - roomType.minArea),
      );
      const latitude =
        area.latitude + (random() - 0.5) * 2 * COORDINATE_JITTER_DEGREES;
      const longitude =
        area.longitude + (random() - 0.5) * 2 * COORDINATE_JITTER_DEGREES;
      const createdAt = new Date(
        Date.now() - Math.floor(random() * 120) * DAY_MS,
      );

      listings.push({
        id,
        ownerId: owners[index % owners.length].id,
        title: `${roomType.label} gần ${area.nearbySchool} số ${index + 1}`,
        description: `${roomType.label} sạch sẽ, an ninh tốt, phù hợp sinh viên. Gần ${area.nearbySchool}, thuận tiện đi lại, chợ và quán ăn xung quanh.`,
        roomType: roomType.code,
        price: String(price),
        area: size.toFixed(2),
        maxOccupants: roomType.maxOccupants,
        electricPrice: '3500',
        waterPrice: '80000',
        deposit: String(price),
        streetAddress,
        provinceCode: DA_NANG_PROVINCE_CODE,
        wardCode: area.wardCode,
        fullAddress: `${streetAddress}, ${area.wardName}, ${DA_NANG_PROVINCE_NAME}`,
        location: { type: 'Point', coordinates: [longitude, latitude] },
        viewingSchedule: null,
        status: pickStatus(index, isBulk),
        createdAt,
        updatedAt: createdAt,
      });

      for (let order = 0; order < IMAGES_PER_LISTING; order += 1) {
        const photo = PHOTO_IDS[(index * 3 + order * 5) % PHOTO_IDS.length];

        images.push({
          listingId: id,
          url: `https://images.unsplash.com/${photo}?w=800&q=80&sig=${index}${order}`,
          isCover: order === 0,
          sortOrder: order,
        });
      }

      [...AMENITY_POOL]
        .sort(() => random() - 0.5)
        .slice(0, 3 + Math.floor(random() * 4))
        .forEach((amenityId) => amenities.push({ listingId: id, amenityId }));
    });

    await dataSource.transaction(async (manager) => {
      if (listings.length > 0) {
        await manager.save(Listing, listings, { chunk: INSERT_BATCH_SIZE });
        await manager.save(ListingImage, images, { chunk: INSERT_BATCH_SIZE });
        await manager.save(ListingAmenity, amenities, {
          chunk: INSERT_BATCH_SIZE,
        });
      }

      await manager
        .createQueryBuilder()
        .insert()
        .into(ListingUniversity)
        .values(universities)
        .orIgnore()
        .execute();
    });
    created += listings.length;
  }

  return created;
}

async function seedChat(
  dataSource: DataSource,
  student: User,
  landlord: User,
): Promise<void> {
  const listing = await dataSource
    .getRepository(Listing)
    .findOneBy({ id: createStableId('dn-base-0'), ownerId: landlord.id });

  if (!listing) return;

  const conversationRepository = dataSource.getRepository(Conversation);
  const messageRepository = dataSource.getRepository(Message);
  const conversation =
    (await conversationRepository.findOneBy({
      listingId: listing.id,
      studentId: student.id,
    })) ??
    (await conversationRepository.save(
      conversationRepository.create({
        listingId: listing.id,
        studentId: student.id,
        landlordId: landlord.id,
      }),
    ));

  if (
    await messageRepository.exists({
      where: { conversationId: conversation.id },
    })
  )
    return;

  const startedAt = Date.now() - DEMO_CHAT.length * 60_000;

  await messageRepository.save(
    DEMO_CHAT.map((entry, index) =>
      messageRepository.create({
        conversationId: conversation.id,
        senderId: entry.fromStudent ? student.id : landlord.id,
        clientMessageId: randomUUID(),
        type: MessageType.TEXT,
        content: entry.content,
        imageKeys: [],
        createdAt: new Date(startedAt + index * 60_000),
      }),
    ),
  );
  await conversationRepository.update(conversation.id, {
    lastMessageAt: new Date(startedAt + (DEMO_CHAT.length - 1) * 60_000),
  });

  console.log(`[Demo] chat between ${student.phone} and ${landlord.phone}`);
}

const requireUser = (users: Map<string, User>, phone: string): User => {
  const user = users.get(phone);

  if (!user) throw new Error(`Demo account ${phone} was not created`);

  return user;
};

export async function seedDemo(
  dataSource: DataSource,
  bulkCount = 0,
): Promise<void> {
  const users = await seedAccounts(dataSource);
  const owners = DEMO_ACCOUNTS.filter(
    (account) => account.isLandlordVerified,
  ).map((account) => requireUser(users, account.phone));
  const baseCreated = await seedListings(
    dataSource,
    owners,
    BASE_LISTING_COUNT,
    'dn-base',
    false,
  );

  console.log(
    `[Demo] ${baseCreated} new Da Nang listings (${BASE_LISTING_COUNT} in total)`,
  );

  if (bulkCount > 0) {
    const bulkCreated = await seedListings(
      dataSource,
      owners,
      bulkCount,
      'dn-bulk',
      true,
    );

    console.log(
      `[Demo] bulk mode: ${bulkCreated} new listings (${bulkCount} in total)`,
    );
  }

  await seedChat(dataSource, requireUser(users, '0900000001'), owners[0]);
}
