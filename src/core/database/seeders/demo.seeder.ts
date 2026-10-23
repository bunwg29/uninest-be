import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { DataSource, In } from 'typeorm';
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
import { Ward } from '@modules/locations/entities';
import { University } from '@modules/universities/entities';
import { User } from '@modules/users/entities';
import { DEMO_ASSETS } from './demo-assets';
import { seedModeration } from './demo-moderation.seeder';

export const DEMO_PASSWORD = 'UniNest@123';

const BASE_LISTING_COUNT = 200;
const INSERT_BATCH_SIZE = 250;
const PASSWORD_HASH_ROUNDS = 10;
const COORDINATE_JITTER_DEGREES = 0.002;
const MIN_IMAGES_PER_LISTING = 3;
const MAX_IMAGES_PER_LISTING = 6;
const IMAGE_PERMUTATION_STEP = 197;
const DAY_MS = 24 * 60 * 60 * 1000;

type RegionCode = 'dn' | 'hn' | 'hcm';

interface DemoArea {
  wardCode: string;
  wardName: string;
  latitude: number;
  longitude: number;
  nearbySchool: string;
  universityCodes: string[];
  streets: string[];
}

interface DemoRegion {
  code: RegionCode;
  provinceCode: string;
  provinceName: string;
  baseCount: number;
  priceFactor: number;
  areas: DemoArea[];
}

const REGIONS: readonly DemoRegion[] = [
  {
    code: 'dn',
    provinceCode: '48',
    provinceName: 'Thành phố Đà Nẵng',
    baseCount: 110,
    priceFactor: 1,
    areas: [
      {
        wardCode: '20200',
        wardName: 'Phường Hoà Khánh',
        latitude: 16.0739,
        longitude: 108.1499,
        nearbySchool: 'ĐH Bách khoa Đà Nẵng',
        universityCodes: ['DDK', 'DDS'],
        streets: ['Nguyễn Lương Bằng', 'Ngô Sĩ Liên', 'Âu Cơ'],
      },
      {
        wardCode: '20197',
        wardName: 'Phường Liên Chiểu',
        latitude: 16.0617,
        longitude: 108.1585,
        nearbySchool: 'ĐH Sư phạm Đà Nẵng',
        universityCodes: ['DDS', 'DDK'],
        streets: ['Tôn Đức Thắng', 'Hoàng Văn Thái', 'Nguyễn Sinh Sắc'],
      },
      {
        wardCode: '20285',
        wardName: 'Phường Ngũ Hành Sơn',
        latitude: 15.9757,
        longitude: 108.2531,
        nearbySchool: 'ĐH CNTT & TT Việt - Hàn (VKU)',
        universityCodes: ['VKU', 'KTD'],
        streets: ['Trần Đại Nghĩa', 'Nam Kỳ Khởi Nghĩa', 'Lê Văn Hiến'],
      },
      {
        wardCode: '20285',
        wardName: 'Phường Ngũ Hành Sơn',
        latitude: 16.0481,
        longitude: 108.2402,
        nearbySchool: 'ĐH Kinh tế Đà Nẵng',
        universityCodes: ['DDQ', 'KTD'],
        streets: ['Ngũ Hành Sơn', 'Lê Văn Hiến', 'Hồ Xuân Hương'],
      },
      {
        wardCode: '20242',
        wardName: 'Phường Hải Châu',
        latitude: 16.0678,
        longitude: 108.2208,
        nearbySchool: 'ĐH Kinh tế Đà Nẵng',
        universityCodes: ['DDQ', 'DDF'],
        streets: ['Nguyễn Văn Linh', 'Phan Đăng Lưu', 'Hùng Vương'],
      },
      {
        wardCode: '20209',
        wardName: 'Phường Thanh Khê',
        latitude: 16.068,
        longitude: 108.19,
        nearbySchool: 'ĐH Sư phạm Đà Nẵng',
        universityCodes: ['DDS', 'DDK'],
        streets: ['Hà Huy Tập', 'Điện Biên Phủ', 'Trần Cao Vân'],
      },
      {
        wardCode: '20263',
        wardName: 'Phường Sơn Trà',
        latitude: 16.085,
        longitude: 108.243,
        nearbySchool: 'ĐH Kinh tế Đà Nẵng',
        universityCodes: ['DDQ'],
        streets: ['Ngô Quyền', 'Phạm Văn Đồng', 'Võ Văn Kiệt'],
      },
      {
        wardCode: '20260',
        wardName: 'Phường Cẩm Lệ',
        latitude: 16.015,
        longitude: 108.2,
        nearbySchool: 'ĐH CNTT & TT Việt - Hàn (VKU)',
        universityCodes: ['VKU', 'DSK'],
        streets: ['Cách Mạng Tháng Tám', 'Ông Ích Đường', 'Lê Đại Hành'],
      },
    ],
  },
  {
    code: 'hn',
    provinceCode: '01',
    provinceName: 'Thành phố Hà Nội',
    baseCount: 50,
    priceFactor: 1.2,
    areas: [
      {
        wardCode: '00292',
        wardName: 'Phường Bạch Mai',
        latitude: 21.0037,
        longitude: 105.8495,
        nearbySchool: 'Đại học Bách khoa Hà Nội',
        universityCodes: ['BKA', 'KHA'],
        streets: ['Tạ Quang Bửu', 'Trần Đại Nghĩa', 'Bạch Mai'],
      },
      {
        wardCode: '00256',
        wardName: 'Phường Hai Bà Trưng',
        latitude: 21.009,
        longitude: 105.858,
        nearbySchool: 'Đại học Kinh tế Quốc dân',
        universityCodes: ['KHA', 'BKA'],
        streets: ['Giải Phóng', 'Lê Thanh Nghị', 'Đại Cồ Việt'],
      },
      {
        wardCode: '00166',
        wardName: 'Phường Cầu Giấy',
        latitude: 21.035,
        longitude: 105.794,
        nearbySchool: 'ĐH Công nghệ - ĐHQG Hà Nội',
        universityCodes: ['QHI', 'QHT', 'SPH'],
        streets: ['Xuân Thủy', 'Cầu Giấy', 'Trần Thái Tông'],
      },
      {
        wardCode: '00235',
        wardName: 'Phường Đống Đa',
        latitude: 21.016,
        longitude: 105.821,
        nearbySchool: 'Đại học Ngoại thương',
        universityCodes: ['NTH', 'GHA'],
        streets: ['Chùa Láng', 'Thái Hà', 'Láng Hạ'],
      },
      {
        wardCode: '00367',
        wardName: 'Phường Thanh Xuân',
        latitude: 20.995,
        longitude: 105.806,
        nearbySchool: 'Đại học Kiến trúc Hà Nội',
        universityCodes: ['KTA', 'YHB'],
        streets: ['Nguyễn Trãi', 'Khuất Duy Tiến', 'Vũ Trọng Phụng'],
      },
    ],
  },
  {
    code: 'hcm',
    provinceCode: '79',
    provinceName: 'Thành phố Hồ Chí Minh',
    baseCount: 40,
    priceFactor: 1.35,
    areas: [
      {
        wardCode: '26800',
        wardName: 'Phường Linh Xuân',
        latitude: 10.874,
        longitude: 106.799,
        nearbySchool: 'ĐH Công nghệ Thông tin - ĐHQG TP.HCM',
        universityCodes: ['QSC', 'QST', 'VNU-HCM'],
        streets: ['Lê Văn Việt', 'Kha Vạn Cân', 'Quốc lộ 1A'],
      },
      {
        wardCode: '26824',
        wardName: 'Phường Thủ Đức',
        latitude: 10.849,
        longitude: 106.771,
        nearbySchool: 'ĐH Sư phạm Kỹ thuật TP.HCM',
        universityCodes: ['SPK', 'QSC'],
        streets: ['Võ Văn Ngân', 'Đặng Văn Bi', 'Hoàng Diệu 2'],
      },
      {
        wardCode: '26929',
        wardName: 'Phường Bình Thạnh',
        latitude: 10.804,
        longitude: 106.711,
        nearbySchool: 'ĐH Công nghệ TP.HCM',
        universityCodes: ['DKC', 'UEF'],
        streets: ['Điện Biên Phủ', 'Ung Văn Khiêm', 'Xô Viết Nghệ Tĩnh'],
      },
      {
        wardCode: '26743',
        wardName: 'Phường Bến Thành',
        latitude: 10.772,
        longitude: 106.696,
        nearbySchool: 'Đại học Kinh tế TP.HCM',
        universityCodes: ['KSA', 'MBS'],
        streets: ['Lê Lai', 'Nguyễn Thị Nghĩa', 'Phạm Ngũ Lão'],
      },
      {
        wardCode: '27073',
        wardName: 'Phường Phú Nhuận',
        latitude: 10.798,
        longitude: 106.679,
        nearbySchool: 'Đại học Công nghiệp TP.HCM',
        universityCodes: ['IUH', 'NTS'],
        streets: ['Phan Xích Long', 'Nguyễn Văn Trỗi', 'Phan Đăng Lưu'],
      },
    ],
  },
];

interface DemoAccount {
  phone: string;
  fullName: string;
  roleId: UserRoleType;
  regionCode: RegionCode;
  isLandlordVerified?: boolean;
}

const STUDENTS: readonly DemoAccount[] = [
  {
    phone: '0900000001',
    fullName: 'Nguyễn Minh Anh',
    roleId: UserRoleType.STUDENT,
    regionCode: 'dn',
  },
  {
    phone: '0900000211',
    fullName: 'Trần Hoàng Nam',
    roleId: UserRoleType.STUDENT,
    regionCode: 'hn',
  },
  {
    phone: '0900000212',
    fullName: 'Lê Thu Hà',
    roleId: UserRoleType.STUDENT,
    regionCode: 'hcm',
  },
  {
    phone: '0900000213',
    fullName: 'Phạm Gia Huy',
    roleId: UserRoleType.STUDENT,
    regionCode: 'dn',
  },
];

const LANDLORD_NAMES = [
  'Nguyễn Văn Hùng',
  'Trần Thị Mai',
  'Lê Quang Vinh',
  'Phạm Thanh Tùng',
  'Võ Thị Lan',
  'Đặng Minh Tuấn',
  'Hoàng Thị Hương',
  'Bùi Quốc Bảo',
  'Đỗ Thanh Hằng',
  'Nguyễn Đức Long',
  'Trương Thị Ngọc',
  'Phan Hữu Phúc',
  'Lý Minh Châu',
  'Hồ Văn Sơn',
  'Mai Thị Phương',
] as const;

const LANDLORD_REGIONS: readonly RegionCode[] = [
  'dn',
  'dn',
  'dn',
  'dn',
  'dn',
  'hn',
  'hn',
  'hn',
  'hn',
  'hcm',
  'hcm',
  'hcm',
  'hcm',
  'dn',
  'dn',
];

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  ...STUDENTS,
  ...LANDLORD_NAMES.map((fullName, index) => {
    const phoneSuffix = index < 10 ? 201 + index : 220 + index - 10;

    return {
      phone: `0900000${phoneSuffix}`,
      fullName,
      roleId: UserRoleType.LANDLORD,
      regionCode: LANDLORD_REGIONS[index],
      isLandlordVerified: index !== 4,
    };
  }),
  {
    phone: '0900000299',
    fullName: 'Quản trị viên UniNest',
    roleId: UserRoleType.ADMIN,
    regionCode: 'dn',
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
    maxPrice: 2_400_000,
    minArea: 14,
    maxArea: 25,
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
    maxPrice: 5_000_000,
    minArea: 25,
    maxArea: 40,
    maxOccupants: 2,
  },
  {
    code: RoomType.KY_TUC_XA,
    label: 'Ký túc xá',
    minPrice: 800_000,
    maxPrice: 1_500_000,
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
  {
    code: RoomType.CAN_HO_DICH_VU,
    label: 'Căn hộ dịch vụ',
    minPrice: 4_000_000,
    maxPrice: 7_000_000,
    minArea: 28,
    maxArea: 50,
    maxOccupants: 3,
  },
];

const AMENITY_POOL = [1, 2, 3, 6, 7, 8, 10, 11, 14, 17] as const;

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

const getRegion = (code: RegionCode): DemoRegion => {
  const region = REGIONS.find((item) => item.code === code);

  if (!region) throw new Error(`Unknown demo region: ${code}`);

  return region;
};

const pickRegion = (index: number, isBulk: boolean): DemoRegion => {
  if (isBulk) {
    const bucket = index % 20;

    return REGIONS[bucket < 11 ? 0 : bucket < 16 ? 1 : 2];
  }

  let offset = index;

  for (const region of REGIONS) {
    if (offset < region.baseCount) return region;

    offset -= region.baseCount;
  }

  throw new Error(`Demo listing index exceeds base count: ${index}`);
};

const pickStatus = (index: number, isBulk: boolean): ListingStatus => {
  const bucket = index % 20;

  if (isBulk)
    return bucket === 19 ? ListingStatus.HIDDEN : ListingStatus.ACTIVE;

  if (bucket === 16) return ListingStatus.PENDING;

  if (bucket === 17) return ListingStatus.HIDDEN;

  if (bucket === 18) return ListingStatus.REJECTED;

  if (bucket === 19) return ListingStatus.RENTED;

  return ListingStatus.ACTIVE;
};

const buildViewingSchedule = (index: number) => ({
  mon: { morning: index % 2 === 0, afternoon: true, evening: index % 3 !== 0 },
  tue: { morning: false, afternoon: true, evening: true },
  wed: { morning: true, afternoon: index % 2 === 0, evening: true },
  thu: { morning: false, afternoon: true, evening: true },
  fri: { morning: true, afternoon: true, evening: index % 3 !== 1 },
  sat: { morning: true, afternoon: true, evening: false },
  sun: { morning: index % 2 === 1, afternoon: true, evening: false },
});

const requireUser = (users: Map<string, User>, phone: string): User => {
  const user = users.get(phone);

  if (!user) throw new Error(`Demo account ${phone} was not created`);

  return user;
};

const validateCatalog = async (dataSource: DataSource): Promise<void> => {
  const wardCodes = [
    ...new Set(
      REGIONS.flatMap((region) => region.areas.map((area) => area.wardCode)),
    ),
  ];
  const universityCodes = [
    ...new Set(
      REGIONS.flatMap((region) =>
        region.areas.flatMap((area) => area.universityCodes),
      ),
    ),
  ];
  const [wards, universities] = await Promise.all([
    dataSource.getRepository(Ward).find({ where: { code: In(wardCodes) } }),
    dataSource
      .getRepository(University)
      .find({ where: { code: In(universityCodes) } }),
  ]);
  const wardByCode = new Map(wards.map((ward) => [ward.code, ward]));
  const foundUniversities = new Set(
    universities.map((university) => university.code),
  );

  for (const region of REGIONS) {
    for (const area of region.areas) {
      if (wardByCode.get(area.wardCode)?.provinceCode !== region.provinceCode) {
        throw new Error(
          `Invalid demo ward ${area.wardCode} in region ${region.code}`,
        );
      }

      for (const code of area.universityCodes) {
        if (!foundUniversities.has(code)) {
          throw new Error(`Missing demo university: ${code}`);
        }
      }
    }
  }

  if (DEMO_ASSETS.length < MAX_IMAGES_PER_LISTING) {
    throw new Error('Not enough shared demo images');
  }
};

async function seedAccounts(
  dataSource: DataSource,
): Promise<Map<string, User>> {
  const repository = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, PASSWORD_HASH_ROUNDS);
  const existingUsers = await repository.find({
    where: { phone: In(DEMO_ACCOUNTS.map((account) => account.phone)) },
  });
  const existingByPhone = new Map(
    existingUsers.map((user) => [user.phone, user]),
  );
  const accounts = DEMO_ACCOUNTS.map((account, index) => {
    const existing = existingByPhone.get(account.phone);
    const region = getRegion(account.regionCode);
    const area = region.areas[index % region.areas.length];
    const streetAddress = `${20 + index * 7} ${area.streets[index % area.streets.length]}`;
    const data: Partial<User> = {
      phone: account.phone,
      email: existing?.email ?? `${account.phone}@uninest.local`,
      fullName: account.fullName,
      roleId: account.roleId,
      passwordHash,
      isActive: true,
      isVerified: true,
      phoneVerified: true,
      identityNumber: `900${String(index + 1).padStart(9, '0')}`,
      landlordVerifiedAt: account.isLandlordVerified ? new Date() : null,
      school:
        account.roleId === UserRoleType.STUDENT ? area.nearbySchool : null,
      provinceCode: region.provinceCode,
      wardCode: area.wardCode,
      streetAddress,
      fullAddress: `${streetAddress}, ${area.wardName}, ${region.provinceName}`,
    };

    return existing
      ? repository.merge(existing, data)
      : repository.create(data);
  });
  const saved = await repository.save(accounts, { chunk: 100 });

  console.log(`[Demo] ${saved.length} accounts ready`);

  return new Map(
    saved.map((user) => {
      if (!user.phone)
        throw new Error('Demo account was saved without a phone');

      return [user.phone, user] as const;
    }),
  );
}

interface ListingDraft {
  ownerId: string;
  title: string;
  data: Partial<Listing>;
  imageKeys: string[];
  amenityIds: number[];
  universityCodes: string[];
}

const buildListingDraft = (
  index: number,
  isBulk: boolean,
  ownersByRegion: Map<RegionCode, User[]>,
): ListingDraft => {
  const region = pickRegion(index, isBulk);
  const owners = ownersByRegion.get(region.code) ?? [];

  if (owners.length === 0)
    throw new Error(`No verified demo landlord in ${region.code}`);

  const owner = owners[index % owners.length];
  const area = region.areas[index % region.areas.length];
  const random = createRandom(index * 7919 + (isBulk ? 17 : 3));
  const roomType = ROOM_TYPES[Math.floor(random() * ROOM_TYPES.length)];
  const streetAddress = `${1 + Math.floor(random() * 220)} ${area.streets[Math.floor(random() * area.streets.length)]}`;
  const price =
    Math.round(
      ((roomType.minPrice +
        random() * (roomType.maxPrice - roomType.minPrice)) *
        region.priceFactor) /
        100_000,
    ) * 100_000;
  const size = Math.round(
    roomType.minArea + random() * (roomType.maxArea - roomType.minArea),
  );
  const latitude =
    area.latitude + (random() - 0.5) * 2 * COORDINATE_JITTER_DEGREES;
  const longitude =
    area.longitude + (random() - 0.5) * 2 * COORDINATE_JITTER_DEGREES;
  const createdAt = new Date(Date.now() - Math.floor(random() * 120) * DAY_MS);
  const ordinal = (isBulk ? BASE_LISTING_COUNT : 0) + index + 1;
  const title = `${roomType.label} gần ${area.nearbySchool} số ${ordinal}`;
  const descriptions = [
    'Phòng thoáng mát, có cửa sổ và chỗ để xe. Khu vực yên tĩnh, phù hợp sinh viên.',
    'Nhà sạch sẽ, lối đi riêng và khu dân cư an ninh. Thuận tiện đi học và mua sắm.',
    'Không gian sáng, có internet và khu sinh hoạt chung. Có thể vào ở ngay.',
    'Phòng được giữ gìn tốt, gần quán ăn và các tuyến đường chính. Ưu tiên người ở lâu dài.',
  ];
  const amenityCount = 3 + Math.floor(random() * 4);
  const imageCount =
    MIN_IMAGES_PER_LISTING +
    Math.floor(
      random() * (MAX_IMAGES_PER_LISTING - MIN_IMAGES_PER_LISTING + 1),
    );
  const firstImageIndex =
    (index * 2 * IMAGE_PERMUTATION_STEP) % DEMO_ASSETS.length;
  const secondImageIndex =
    ((index * 2 + 1) * IMAGE_PERMUTATION_STEP) % DEMO_ASSETS.length;
  let coverImageIndex = Math.floor(random() * DEMO_ASSETS.length);

  while (
    coverImageIndex === firstImageIndex ||
    coverImageIndex === secondImageIndex
  ) {
    coverImageIndex = (coverImageIndex + 1) % DEMO_ASSETS.length;
  }

  const imageKeys = new Set([
    DEMO_ASSETS[coverImageIndex].key,
    DEMO_ASSETS[firstImageIndex].key,
    DEMO_ASSETS[secondImageIndex].key,
  ]);

  while (imageKeys.size < imageCount) {
    imageKeys.add(DEMO_ASSETS[Math.floor(random() * DEMO_ASSETS.length)].key);
  }

  return {
    ownerId: owner.id,
    title,
    data: {
      ownerId: owner.id,
      title,
      description: descriptions[index % descriptions.length],
      roomType: roomType.code,
      price: String(price),
      area: size.toFixed(2),
      maxOccupants: roomType.maxOccupants,
      electricPrice: '3500',
      waterPrice: '80000',
      deposit: String(price),
      streetAddress,
      provinceCode: region.provinceCode,
      wardCode: area.wardCode,
      fullAddress: `${streetAddress}, ${area.wardName}, ${region.provinceName}`,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      viewingSchedule: buildViewingSchedule(index),
      status: pickStatus(index, isBulk),
      createdAt,
      updatedAt: createdAt,
    },
    imageKeys: [...imageKeys],
    amenityIds: Array.from(
      { length: amenityCount },
      (_, order) => AMENITY_POOL[(index * 3 + order * 3) % AMENITY_POOL.length],
    ),
    universityCodes: area.universityCodes,
  };
};

async function seedListings(
  dataSource: DataSource,
  ownersByRegion: Map<RegionCode, User[]>,
  total: number,
  isBulk: boolean,
): Promise<{ created: number; firstListingId: string | null }> {
  let created = 0;
  let firstListingId: string | null = null;

  for (let offset = 0; offset < total; offset += INSERT_BATCH_SIZE) {
    const drafts = Array.from(
      { length: Math.min(INSERT_BATCH_SIZE, total - offset) },
      (_, position) =>
        buildListingDraft(offset + position, isBulk, ownersByRegion),
    );
    const batch = await dataSource.transaction(async (manager) => {
      const existing = await manager.getRepository(Listing).find({
        select: { id: true, ownerId: true, title: true },
        where: { title: In(drafts.map((draft) => draft.title)) },
        withDeleted: true,
      });
      const existingByTitleAndOwner = new Map(
        existing.map((listing) => [
          `${listing.ownerId}:${listing.title}`,
          listing.id,
        ]),
      );
      const missing = drafts.filter(
        (draft) =>
          !existingByTitleAndOwner.has(`${draft.ownerId}:${draft.title}`),
      );
      const saved = missing.length
        ? await manager.save(
            Listing,
            missing.map((draft) => manager.create(Listing, draft.data)),
            { chunk: INSERT_BATCH_SIZE },
          )
        : [];
      const images: ListingImage[] = [];
      const amenities: ListingAmenity[] = [];
      const universities: ListingUniversity[] = [];

      saved.forEach((listing, index) => {
        const draft = missing[index];

        existingByTitleAndOwner.set(
          `${draft.ownerId}:${draft.title}`,
          listing.id,
        );
        draft.imageKeys.forEach((key, order) =>
          images.push(
            manager.create(ListingImage, {
              listingId: listing.id,
              url: key,
              isCover: order === 0,
              sortOrder: order,
            }),
          ),
        );
        draft.amenityIds.forEach((amenityId) =>
          amenities.push(
            manager.create(ListingAmenity, {
              listingId: listing.id,
              amenityId,
            }),
          ),
        );
        draft.universityCodes.forEach((universityCode, position) =>
          universities.push(
            manager.create(ListingUniversity, {
              listingId: listing.id,
              universityCode,
              position,
            }),
          ),
        );
      });

      if (images.length) {
        await manager.save(ListingImage, images, { chunk: INSERT_BATCH_SIZE });
        await manager.save(ListingAmenity, amenities, {
          chunk: INSERT_BATCH_SIZE,
        });
        await manager.save(ListingUniversity, universities, {
          chunk: INSERT_BATCH_SIZE,
        });
      }

      return {
        created: saved.length,
        firstListingId:
          existingByTitleAndOwner.get(
            `${drafts[0].ownerId}:${drafts[0].title}`,
          ) ?? null,
      };
    });

    created += batch.created;

    if (offset === 0) firstListingId = batch.firstListingId;
  }

  return { created, firstListingId };
}

async function seedChat(
  dataSource: DataSource,
  listingId: string | null,
  student: User,
  landlord: User,
): Promise<void> {
  if (!listingId) return;

  const conversationRepository = dataSource.getRepository(Conversation);
  const messageRepository = dataSource.getRepository(Message);
  const conversation =
    (await conversationRepository.findOneBy({
      listingId,
      studentId: student.id,
    })) ??
    (await conversationRepository.save(
      conversationRepository.create({
        listingId,
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

  console.log('[Demo] Sample conversation ready');
}

export async function seedDemo(
  dataSource: DataSource,
  bulkCount = 0,
): Promise<void> {
  if (
    REGIONS.reduce((total, region) => total + region.baseCount, 0) !==
    BASE_LISTING_COUNT
  ) {
    throw new Error('Demo region listing counts do not match the base count');
  }

  await validateCatalog(dataSource);

  const users = await seedAccounts(dataSource);
  const ownersByRegion = new Map<RegionCode, User[]>(
    REGIONS.map((region) => [
      region.code,
      DEMO_ACCOUNTS.filter(
        (account) =>
          account.roleId === UserRoleType.LANDLORD &&
          account.regionCode === region.code &&
          account.isLandlordVerified,
      ).map((account) => requireUser(users, account.phone)),
    ]),
  );
  const base = await seedListings(
    dataSource,
    ownersByRegion,
    BASE_LISTING_COUNT,
    false,
  );

  console.log(
    `[Demo] ${base.created} new listings (200 total: 110 Da Nang, 50 Ha Noi, 40 Ho Chi Minh City)`,
  );

  if (bulkCount > 0) {
    const bulk = await seedListings(
      dataSource,
      ownersByRegion,
      bulkCount,
      true,
    );

    console.log(
      `[Demo] ${bulk.created} new bulk listings (${bulkCount} total)`,
    );
  }

  await seedChat(
    dataSource,
    base.firstListingId,
    requireUser(users, '0900000001'),
    requireUser(users, '0900000201'),
  );

  await seedModeration(dataSource, users);
}
