import { createHash } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { DataSource, In } from 'typeorm';
import { UserRoleType } from '@common/constants';
import {
  Listing,
  ListingAmenity,
  ListingImage,
  ListingStatus,
} from '@modules/listings/entities';
import { Province, Ward } from '@modules/locations/entities';
import { User } from '@modules/users/entities';

const DA_NANG_PROVINCE_CODE = '48';
const BASE_LISTING_COUNT = 60;
const DEFAULT_BULK_COUNT = 5000;
const MIN_LISTINGS_PER_WARD = 6;
const MIN_MAIN_WARDS = 6;
const INSERT_BATCH_SIZE = 250;
const SEED_PASSWORD = 'UniNest@123';
const PASSWORD_HASH_ROUNDS = 10;
const COORDINATE_JITTER_DEGREES = 0.004;
const IMAGES_PER_LISTING = 4;

interface WardAnchor {
  keyword: string;
  latitude: number;
  longitude: number;
  university: string;
}

const WARD_ANCHORS: readonly WardAnchor[] = [
  {
    keyword: 'Hòa Khánh',
    latitude: 16.0739,
    longitude: 108.1499,
    university: 'ĐH Bách khoa Đà Nẵng',
  },
  {
    keyword: 'Liên Chiểu',
    latitude: 16.0617,
    longitude: 108.1585,
    university: 'ĐH Sư phạm Đà Nẵng',
  },
  {
    keyword: 'Hòa Quý',
    latitude: 15.9757,
    longitude: 108.2531,
    university: 'ĐH CNTT & TT Việt - Hàn (VKU)',
  },
  {
    keyword: 'Ngũ Hành Sơn',
    latitude: 16.0481,
    longitude: 108.2402,
    university: 'ĐH Kinh tế Đà Nẵng',
  },
  {
    keyword: 'Hải Châu',
    latitude: 16.0678,
    longitude: 108.2208,
    university: 'ĐH Kinh tế Đà Nẵng',
  },
  {
    keyword: 'Thanh Khê',
    latitude: 16.068,
    longitude: 108.19,
    university: 'ĐH Sư phạm Đà Nẵng',
  },
  {
    keyword: 'Sơn Trà',
    latitude: 16.085,
    longitude: 108.243,
    university: 'ĐH Kinh tế Đà Nẵng',
  },
  {
    keyword: 'Cẩm Lệ',
    latitude: 16.015,
    longitude: 108.2,
    university: 'ĐH CNTT & TT Việt - Hàn (VKU)',
  },
];

const FALLBACK_WARDS = WARD_ANCHORS.map((anchor, index) => ({
  code: `48-DEV-${index + 1}`,
  name: anchor.keyword,
  fullName: `Phường ${anchor.keyword}`,
}));

interface RoomTypeSpec {
  roomType: string;
  label: string;
  minPrice: number;
  maxPrice: number;
  minArea: number;
  maxArea: number;
  maxOccupants: number;
}

const ROOM_TYPES: readonly RoomTypeSpec[] = [
  {
    roomType: 'phong_tro',
    label: 'Phòng trọ',
    minPrice: 1_200_000,
    maxPrice: 2_200_000,
    minArea: 14,
    maxArea: 24,
    maxOccupants: 2,
  },
  {
    roomType: 'chung_cu_mini',
    label: 'Chung cư mini',
    minPrice: 2_500_000,
    maxPrice: 4_200_000,
    minArea: 22,
    maxArea: 35,
    maxOccupants: 3,
  },
  {
    roomType: 'studio',
    label: 'Studio',
    minPrice: 3_000_000,
    maxPrice: 4_800_000,
    minArea: 25,
    maxArea: 38,
    maxOccupants: 2,
  },
  {
    roomType: 'ky_tuc_xa',
    label: 'Phòng ở ghép',
    minPrice: 800_000,
    maxPrice: 1_400_000,
    minArea: 16,
    maxArea: 28,
    maxOccupants: 4,
  },
  {
    roomType: 'nha_nguyen_can',
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
  'Ngũ Hành Sơn',
  'Nguyễn Văn Linh',
  'Hà Huy Tập',
  'Điện Biên Phủ',
  'Mẫu Đơn',
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

const LANDLORDS = [
  { phone: '0900000201', name: 'Nguyễn Văn Hùng', verified: true },
  { phone: '0900000202', name: 'Trần Thị Mai', verified: true },
  { phone: '0900000203', name: 'Lê Quang Vinh', verified: true },
  { phone: '0900000204', name: 'Phạm Thanh Tùng', verified: true },
  { phone: '0900000205', name: 'Võ Thị Lan (chờ xác minh)', verified: false },
] as const;

const STUDENT_ACCOUNTS = [
  { phone: '0900000211', name: 'Sinh viên Bách khoa' },
  { phone: '0900000212', name: 'Sinh viên Kinh tế' },
] as const;

const ADMIN_ACCOUNT = { phone: '0900000299', name: 'Quản trị viên UniNest' };

interface MainWard {
  code: string;
  fullName: string;
  anchor: WardAnchor;
}

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

async function ensureWards(dataSource: DataSource): Promise<MainWard[]> {
  const provinceRepository = dataSource.getRepository(Province);
  const wardRepository = dataSource.getRepository(Ward);
  const province = await provinceRepository.findOneBy({
    code: DA_NANG_PROVINCE_CODE,
  });

  if (!province) {
    throw new Error(
      'Chưa có dữ liệu địa giới Đà Nẵng. Hãy chạy `npm run seed -- locations` trước',
    );
  }

  let wards = await wardRepository.findBy({
    provinceCode: DA_NANG_PROVINCE_CODE,
  });
  const matchCount = WARD_ANCHORS.filter((anchor) =>
    wards.some((ward) => ward.fullName.includes(anchor.keyword)),
  ).length;

  if (matchCount < MIN_MAIN_WARDS) {
    const existingCodes = new Set(wards.map((ward) => ward.code));
    const missing = FALLBACK_WARDS.filter(
      (ward) =>
        !existingCodes.has(ward.code) &&
        !wards.some((existing) => existing.fullName.includes(ward.name)),
    );

    if (missing.length > 0) {
      await wardRepository.save(
        missing.map((ward) =>
          wardRepository.create({
            code: ward.code,
            name: ward.name,
            fullName: ward.fullName,
            codeName: ward.name.toLowerCase().replaceAll(' ', '_'),
            provinceCode: DA_NANG_PROVINCE_CODE,
          }),
        ),
      );
      console.log(
        `[Da Nang seeder] Location data was incomplete, added ${missing.length} wards for the development environment`,
      );
    }

    wards = await wardRepository.findBy({
      provinceCode: DA_NANG_PROVINCE_CODE,
    });
  }

  return WARD_ANCHORS.flatMap((anchor) => {
    const ward = wards.find((item) => item.fullName.includes(anchor.keyword));

    return ward ? [{ code: ward.code, fullName: ward.fullName, anchor }] : [];
  });
}

async function ensureUsers(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, PASSWORD_HASH_ROUNDS);
  const upsert = async (
    phone: string,
    fullName: string,
    roleId: UserRoleType,
    isLandlordVerified: boolean,
  ): Promise<User> => {
    const existing = await userRepository.findOneBy({ phone });
    const data: Partial<User> = {
      phone,
      email: `${phone}@uninest.local`,
      fullName,
      roleId,
      passwordHash,
      isActive: true,
      isVerified: true,
      phoneVerified: true,
      landlordVerifiedAt:
        roleId === UserRoleType.LANDLORD && isLandlordVerified
          ? new Date()
          : null,
    };

    return userRepository.save(
      existing
        ? userRepository.merge(existing, data)
        : userRepository.create(data),
    );
  };
  const landlords: User[] = [];

  for (const landlord of LANDLORDS) {
    landlords.push(
      await upsert(
        landlord.phone,
        landlord.name,
        UserRoleType.LANDLORD,
        landlord.verified,
      ),
    );
  }

  for (const student of STUDENT_ACCOUNTS) {
    await upsert(student.phone, student.name, UserRoleType.STUDENT, false);
  }

  await upsert(
    ADMIN_ACCOUNT.phone,
    ADMIN_ACCOUNT.name,
    UserRoleType.ADMIN,
    false,
  );

  return landlords.filter((_, index) => LANDLORDS[index].verified);
}

async function insertListings(
  dataSource: DataSource,
  wards: MainWard[],
  owners: User[],
  total: number,
  keyPrefix: string,
  isBulk: boolean,
): Promise<number> {
  const listingRepository = dataSource.getRepository(Listing);
  const imageRepository = dataSource.getRepository(ListingImage);
  const amenityRepository = dataSource.getRepository(ListingAmenity);
  let created = 0;

  for (let offset = 0; offset < total; offset += INSERT_BATCH_SIZE) {
    const indexes = Array.from(
      { length: Math.min(INSERT_BATCH_SIZE, total - offset) },
      (_, index) => offset + index,
    );
    const ids = indexes.map((index) => createStableId(`${keyPrefix}-${index}`));
    const existing = new Set(
      (
        await listingRepository.find({
          select: { id: true },
          where: { id: In(ids) },
          withDeleted: true,
        })
      ).map((listing) => listing.id),
    );
    const listings: Listing[] = [];
    const images: ListingImage[] = [];
    const amenities: ListingAmenity[] = [];

    indexes.forEach((index, position) => {
      const id = ids[position];

      if (existing.has(id)) return;

      const random = createRandom(index * 7919 + (isBulk ? 17 : 3));
      const ward = wards[index % wards.length];
      const spec = ROOM_TYPES[Math.floor(random() * ROOM_TYPES.length)];
      const street = STREETS[Math.floor(random() * STREETS.length)];
      const houseNumber = 1 + Math.floor(random() * 220);
      const price =
        Math.round(
          (spec.minPrice + random() * (spec.maxPrice - spec.minPrice)) /
            100_000,
        ) * 100_000;
      const area = Math.round(
        spec.minArea + random() * (spec.maxArea - spec.minArea),
      );
      const latitude =
        ward.anchor.latitude + (random() - 0.5) * 2 * COORDINATE_JITTER_DEGREES;
      const longitude =
        ward.anchor.longitude +
        (random() - 0.5) * 2 * COORDINATE_JITTER_DEGREES;
      const streetAddress = `${houseNumber} ${street}`;
      const createdAt = new Date(
        Date.now() - Math.floor(random() * 120) * 24 * 60 * 60 * 1000,
      );

      listings.push(
        listingRepository.create({
          id,
          ownerId: owners[index % owners.length].id,
          title: `${spec.label} gần ${ward.anchor.university} số ${index + 1}`,
          description: `${spec.label} sạch sẽ, an ninh tốt, phù hợp sinh viên. Gần ${ward.anchor.university}, thuận tiện đi lại, chợ và quán ăn xung quanh.`,
          roomType: spec.roomType,
          price: String(price),
          area: area.toFixed(2),
          maxOccupants: spec.maxOccupants,
          electricPrice: '3500',
          waterPrice: '80000',
          deposit: String(price),
          streetAddress,
          provinceCode: DA_NANG_PROVINCE_CODE,
          wardCode: ward.code,
          fullAddress: `${streetAddress}, ${ward.fullName}, Thành phố Đà Nẵng`,
          location: { type: 'Point', coordinates: [longitude, latitude] },
          viewingSchedule: null,
          status: pickStatus(index, isBulk),
          createdAt,
          updatedAt: createdAt,
        }),
      );

      for (
        let imageIndex = 0;
        imageIndex < IMAGES_PER_LISTING;
        imageIndex += 1
      ) {
        const photo =
          PHOTO_IDS[(index * 3 + imageIndex * 5) % PHOTO_IDS.length];

        images.push(
          imageRepository.create({
            listingId: id,
            url: `https://images.unsplash.com/${photo}?w=800&q=80&sig=${index}${imageIndex}`,
            isCover: imageIndex === 0,
            sortOrder: imageIndex,
          }),
        );
      }

      const amenityCount = 3 + Math.floor(random() * 4);

      [...AMENITY_POOL]
        .sort(() => random() - 0.5)
        .slice(0, amenityCount)
        .forEach((amenityId) =>
          amenities.push(
            amenityRepository.create({ listingId: id, amenityId }),
          ),
        );
    });

    if (listings.length > 0) {
      await listingRepository.save(listings, { chunk: INSERT_BATCH_SIZE });
      await imageRepository.save(images, { chunk: INSERT_BATCH_SIZE });
      await amenityRepository.save(amenities, { chunk: INSERT_BATCH_SIZE });
      created += listings.length;
    }
  }

  return created;
}

export async function seedDaNang(dataSource: DataSource): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Không được chạy seeder dữ liệu mẫu ở môi trường triển khai',
    );
  }

  const bulkArgument = process.argv.find((argument) =>
    argument.startsWith('--bulk'),
  );
  const bulkCount = bulkArgument
    ? Number(bulkArgument.split('=')[1] ?? DEFAULT_BULK_COUNT) ||
      DEFAULT_BULK_COUNT
    : 0;
  const wards = await ensureWards(dataSource);

  if (wards.length === 0) {
    throw new Error('Không tìm thấy phường nào của Đà Nẵng để nạp dữ liệu');
  }

  const owners = await ensureUsers(dataSource);
  const baseTotal = Math.max(
    BASE_LISTING_COUNT,
    wards.length * MIN_LISTINGS_PER_WARD * 2,
  );
  const baseCreated = await insertListings(
    dataSource,
    wards,
    owners,
    baseTotal,
    'dn-base',
    false,
  );

  console.log(
    `[Da Nang seeder] Sample listings: ${baseCreated} created (${baseTotal} required in total), ${wards.length} main wards`,
  );

  if (bulkCount > 0) {
    const bulkCreated = await insertListings(
      dataSource,
      wards,
      owners,
      bulkCount,
      'dn-bulk',
      true,
    );

    console.log(
      `[Da Nang seeder] Bulk mode: ${bulkCreated} listings created (target ${bulkCount})`,
    );
  }

  console.log(
    `[Da Nang seeder] Sample accounts (password ${SEED_PASSWORD}): Student ${STUDENT_ACCOUNTS[0].phone}, Landlord ${LANDLORDS[0].phone}, Unverified landlord ${LANDLORDS[4].phone}, Admin ${ADMIN_ACCOUNT.phone}`,
  );
}
