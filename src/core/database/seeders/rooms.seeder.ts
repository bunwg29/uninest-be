import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { UserRoleType } from '@common/constants';
import {
  Listing,
  ListingAmenity,
  ListingImage,
  ListingStatus,
} from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

type UniversityCode =
  'DHQG_TPHCM' | 'BK_TPHCM' | 'KT_TPHCM' | 'DHQG_HN' | 'BK_HN';

type AmenityField = keyof RoomAmenities;

interface RoomAmenities {
  hasWifi: boolean;
  hasAirConditioner: boolean;
  hasWaterHeater: boolean;
  hasParking: boolean;
  hasSecurity: boolean;
  hasFridge: boolean;
  hasWashingMachine: boolean;
  hasKitchen: boolean;
  hasPrivateToilet: boolean;
  hasBalcony: boolean;
}

interface RoomSeedData {
  title: string;
  description: string;
  address: string;
  streetAddress: string;
  provinceCode: string;
  wardCode: string;
  latitude: number;
  longitude: number;
  price: number;
  area: number;
  roomType: string;
  maxOccupants: number;
  electricPrice: number;
  waterPrice: number;
  deposit: number;
  images: string[];
  amenities: RoomAmenities;
  status: 'AVAILABLE';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  universityNearby: UniversityCode;
  distanceToUniversity: number;
}

interface UniversityCenter {
  latitude: number;
  longitude: number;
}

interface LandlordSeedData {
  id: string;
  email: string;
  phone: string;
  fullName: string;
}

interface StudentSeedData {
  id: string;
  email: string;
  phone: string;
  fullName: string;
}

interface SeededRoom {
  listingId: string;
  room: RoomSeedData;
}

interface DistanceResult {
  distance: string;
}

interface AggregateResult {
  count: string;
  minimumPrice: string;
  maximumPrice: string;
}

const ROOMS_DATA_PATH = path.resolve(__dirname, 'data/rooms-data.json');
const EXPECTED_ROOM_COUNT = 55;
const MAXIMUM_UNIVERSITY_DISTANCE_METERS = 3000;
const LANDLORD_PASSWORD = 'UniNest@123';
const STUDENT_PASSWORD = 'UniNest@123';
const PASSWORD_HASH_ROUNDS = 10;

const STUDENT: StudentSeedData = {
  id: '22222222-2222-4222-8222-222222222001',
  email: 'sinhvien@uninest.local',
  phone: '0900000001',
  fullName: 'Sinh viên UniNest',
};

const UNIVERSITY_CENTERS: Record<UniversityCode, UniversityCenter> = {
  DHQG_TPHCM: { latitude: 10.8700123, longitude: 106.8021432 },
  BK_TPHCM: { latitude: 10.7721234, longitude: 106.6578765 },
  KT_TPHCM: { latitude: 10.7820432, longitude: 106.6937543 },
  DHQG_HN: { latitude: 21.0378123, longitude: 105.7819876 },
  BK_HN: { latitude: 21.0048123, longitude: 105.8431432 },
};

const EXPECTED_UNIVERSITY_DISTRIBUTION: Record<UniversityCode, number> = {
  DHQG_TPHCM: 15,
  BK_TPHCM: 10,
  KT_TPHCM: 8,
  DHQG_HN: 12,
  BK_HN: 10,
};

const LANDLORDS: LandlordSeedData[] = [
  {
    id: '11111111-1111-4111-8111-111111111001',
    email: 'chutro1@uninest.local',
    phone: '0900000101',
    fullName: 'Nguyễn Minh An',
  },
  {
    id: '11111111-1111-4111-8111-111111111002',
    email: 'chutro2@uninest.local',
    phone: '0900000102',
    fullName: 'Trần Thu Hà',
  },
  {
    id: '11111111-1111-4111-8111-111111111003',
    email: 'chutro3@uninest.local',
    phone: '0900000103',
    fullName: 'Lê Quốc Bảo',
  },
  {
    id: '11111111-1111-4111-8111-111111111004',
    email: 'chutro4@uninest.local',
    phone: '0900000104',
    fullName: 'Phạm Ngọc Lan',
  },
  {
    id: '11111111-1111-4111-8111-111111111005',
    email: 'chutro5@uninest.local',
    phone: '0900000105',
    fullName: 'Đỗ Hoàng Nam',
  },
];

const AMENITY_IDS_BY_FIELD: ReadonlyArray<readonly [AmenityField, number]> = [
  ['hasWifi', 6],
  ['hasAirConditioner', 1],
  ['hasWaterHeater', 17],
  ['hasParking', 7],
  ['hasSecurity', 11],
  ['hasFridge', 2],
  ['hasWashingMachine', 3],
  ['hasKitchen', 8],
  ['hasPrivateToilet', 14],
  ['hasBalcony', 10],
];

const BEDROOM_IMAGE_IDS = [
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
  'photo-1560448204-e02f11c3d0e2',
  'photo-1554995207-c18c203602cb',
  'photo-1502672260266-1c1ef2d93688',
  'photo-1540518614846-7eded433c457',
] as const;

const ROOM_LIMITS: Record<
  string,
  {
    minimumPrice: number;
    maximumPrice: number;
    minimumArea: number;
    maximumArea: number;
  }
> = {
  phong_don_co_ban: {
    minimumPrice: 1200000,
    maximumPrice: 1800000,
    minimumArea: 12,
    maximumArea: 15,
  },
  phong_don_wc_rieng: {
    minimumPrice: 2000000,
    maximumPrice: 2800000,
    minimumArea: 15,
    maximumArea: 20,
  },
  phong_gac_lung: {
    minimumPrice: 2800000,
    maximumPrice: 3800000,
    minimumArea: 20,
    maximumArea: 25,
  },
  phong_may_lanh: {
    minimumPrice: 3500000,
    maximumPrice: 4500000,
    minimumArea: 20,
    maximumArea: 30,
  },
  studio_mini: {
    minimumPrice: 4500000,
    maximumPrice: 6000000,
    minimumArea: 25,
    maximumArea: 35,
  },
};

const ROOM_IMAGE_URL_PATTERN =
  /^https:\/\/images\.unsplash\.com\/photo-[^?]+\?w=800&q=80&sig=\d{3}$/;

function readRoomsData(): RoomSeedData[] {
  const content = fs.readFileSync(ROOMS_DATA_PATH, 'utf8');
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('Dữ liệu phòng phải là một mảng JSON');
  }

  return parsed as RoomSeedData[];
}

function validateRoomsData(rooms: RoomSeedData[]): void {
  if (rooms.length !== EXPECTED_ROOM_COUNT) {
    throw new Error(
      `Dữ liệu phải có đúng ${EXPECTED_ROOM_COUNT} phòng, hiện có ${rooms.length} phòng`,
    );
  }

  const distribution = new Map<UniversityCode, number>();
  const listingKeys = new Set<string>();
  const coordinates = new Set<string>();
  const imageUrls = new Set<string>();

  for (const room of rooms) {
    const limits = ROOM_LIMITS[room.roomType];
    const universityCenter = UNIVERSITY_CENTERS[room.universityNearby];
    const listingKey = `${room.title}|${room.address}`;
    const coordinateKey = `${room.latitude}|${room.longitude}`;

    if (!limits || !universityCenter) {
      throw new Error(
        `Phòng "${room.title}" có loại phòng hoặc trường không hợp lệ`,
      );
    }

    if (listingKeys.has(listingKey)) {
      throw new Error(`Trùng tiêu đề và địa chỉ: ${room.title}`);
    }

    if (coordinates.has(coordinateKey)) {
      throw new Error(`Trùng tọa độ tại phòng: ${room.title}`);
    }

    if (
      !room.address.trim() ||
      room.latitude === 0 ||
      room.longitude === 0 ||
      !Number.isFinite(room.latitude) ||
      !Number.isFinite(room.longitude)
    ) {
      throw new Error(`Phòng "${room.title}" thiếu địa chỉ hoặc tọa độ hợp lệ`);
    }

    if (room.description.length < 100 || room.description.length > 200) {
      throw new Error(
        `Mô tả phòng "${room.title}" phải dài từ 100 đến 200 ký tự`,
      );
    }

    if (
      room.price % 100000 !== 0 ||
      room.price < limits.minimumPrice ||
      room.price > limits.maximumPrice ||
      room.area < limits.minimumArea ||
      room.area > limits.maximumArea
    ) {
      throw new Error(`Giá hoặc diện tích phòng "${room.title}" không hợp lệ`);
    }

    if (room.images.length < 4 || room.images.length > 6) {
      throw new Error(`Phòng "${room.title}" phải có từ 4 đến 6 ảnh`);
    }

    if (
      !BEDROOM_IMAGE_IDS.some((imageId) => room.images[0]?.includes(imageId))
    ) {
      throw new Error(
        `Ảnh đầu tiên của phòng "${room.title}" phải là ảnh phòng ngủ`,
      );
    }

    for (const imageUrl of room.images) {
      if (!ROOM_IMAGE_URL_PATTERN.test(imageUrl)) {
        throw new Error(
          `URL ảnh không đúng định dạng tại phòng "${room.title}"`,
        );
      }

      if (imageUrls.has(imageUrl)) {
        throw new Error(`URL ảnh bị trùng tại phòng "${room.title}"`);
      }

      imageUrls.add(imageUrl);
    }

    if (
      room.status !== 'AVAILABLE' ||
      room.distanceToUniversity <= 0 ||
      room.distanceToUniversity > MAXIMUM_UNIVERSITY_DISTANCE_METERS
    ) {
      throw new Error(
        `Trạng thái hoặc khoảng cách của phòng "${room.title}" không hợp lệ`,
      );
    }

    if (
      Number.isNaN(Date.parse(room.createdAt)) ||
      Number.isNaN(Date.parse(room.updatedAt))
    ) {
      throw new Error(`Mốc thời gian của phòng "${room.title}" không hợp lệ`);
    }

    if (
      !Object.values(room.amenities).every(
        (value) => typeof value === 'boolean',
      )
    ) {
      throw new Error(
        `Tiện ích phòng "${room.title}" phải dùng giá trị boolean`,
      );
    }

    listingKeys.add(listingKey);
    coordinates.add(coordinateKey);
    distribution.set(
      room.universityNearby,
      (distribution.get(room.universityNearby) ?? 0) + 1,
    );
  }

  for (const [universityCode, expectedCount] of Object.entries(
    EXPECTED_UNIVERSITY_DISTRIBUTION,
  ) as [UniversityCode, number][]) {
    const actualCount = distribution.get(universityCode) ?? 0;

    if (actualCount !== expectedCount) {
      throw new Error(
        `Phân bổ ${universityCode} phải là ${expectedCount} phòng, hiện có ${actualCount} phòng`,
      );
    }
  }
}

async function seedLandlords(
  dataSource: DataSource,
): Promise<Map<string, string>> {
  const userRepository = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash(
    LANDLORD_PASSWORD,
    PASSWORD_HASH_ROUNDS,
  );
  const ownerIds = new Map<string, string>();

  for (const landlord of LANDLORDS) {
    const existingLandlord = await userRepository.findOne({
      where: { email: landlord.email },
    });

    if (existingLandlord) {
      existingLandlord.fullName = landlord.fullName;
      existingLandlord.phone = landlord.phone;
      existingLandlord.roleId = UserRoleType.LANDLORD;
      existingLandlord.isActive = true;
      existingLandlord.isVerified = true;
      existingLandlord.phoneVerified = true;

      const savedLandlord = await userRepository.save(existingLandlord);

      ownerIds.set(landlord.id, savedLandlord.id);
      continue;
    }

    const savedLandlord = await userRepository.save(
      userRepository.create({
        id: landlord.id,
        email: landlord.email,
        phone: landlord.phone,
        passwordHash,
        fullName: landlord.fullName,
        roleId: UserRoleType.LANDLORD,
        isActive: true,
        isVerified: true,
        phoneVerified: true,
        avatarUrl: null,
        school: null,
        bio: null,
        interestedAreas: null,
        provinceCode: null,
        wardCode: null,
        streetAddress: null,
        fullAddress: null,
      }),
    );

    ownerIds.set(landlord.id, savedLandlord.id);
  }

  console.log(`Đã bảo đảm ${LANDLORDS.length} tài khoản chủ trọ mẫu`);

  return ownerIds;
}

async function seedStudent(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash(
    STUDENT_PASSWORD,
    PASSWORD_HASH_ROUNDS,
  );
  const existingStudent = await userRepository.findOne({
    where: { email: STUDENT.email },
  });
  const studentData: Partial<User> = {
    email: STUDENT.email,
    phone: STUDENT.phone,
    passwordHash,
    fullName: STUDENT.fullName,
    roleId: UserRoleType.STUDENT,
    isActive: true,
    isVerified: true,
    phoneVerified: true,
    avatarUrl: null,
    school: null,
    bio: null,
    interestedAreas: null,
    provinceCode: null,
    wardCode: null,
    streetAddress: null,
    fullAddress: null,
  };
  const student = existingStudent
    ? userRepository.merge(existingStudent, studentData)
    : userRepository.create({ id: STUDENT.id, ...studentData });

  await userRepository.save(student);
  console.log('Đã bảo đảm tài khoản sinh viên mẫu');
}

function getAmenityIds(room: RoomSeedData): number[] {
  const amenityIds = AMENITY_IDS_BY_FIELD.filter(
    ([field]) => room.amenities[field],
  ).map(([, amenityId]) => amenityId);

  if (room.price >= 3500000 && room.amenities.hasSecurity) {
    amenityIds.push(12);
  }

  if (room.price >= 2800000) {
    amenityIds.push(5, 15);
  }

  return [...new Set(amenityIds)];
}

async function upsertRoom(
  manager: EntityManager,
  room: RoomSeedData,
  ownerIds: Map<string, string>,
): Promise<SeededRoom> {
  const listingRepository = manager.getRepository(Listing);
  const imageRepository = manager.getRepository(ListingImage);
  const listingAmenityRepository = manager.getRepository(ListingAmenity);
  const ownerId = ownerIds.get(room.ownerId);

  if (!ownerId) {
    throw new Error(`Không tìm thấy chủ trọ cho phòng "${room.title}"`);
  }

  const existingListing = await listingRepository.findOne({
    where: { title: room.title, fullAddress: room.address },
    withDeleted: true,
  });
  const listingData: Partial<Listing> = {
    ownerId,
    title: room.title,
    description: room.description,
    roomType: room.roomType,
    price: String(room.price),
    area: room.area.toFixed(2),
    maxOccupants: room.maxOccupants,
    electricPrice: String(room.electricPrice),
    waterPrice: String(room.waterPrice),
    deposit: String(room.deposit),
    streetAddress: room.streetAddress,
    provinceCode: room.provinceCode,
    wardCode: room.wardCode,
    fullAddress: room.address,
    location: {
      type: 'Point',
      coordinates: [room.longitude, room.latitude],
    },
    viewingSchedule: null,
    status: ListingStatus.ACTIVE,
    createdAt: new Date(room.createdAt),
    updatedAt: new Date(room.updatedAt),
    deletedAt: null,
  };
  const listing = existingListing
    ? listingRepository.merge(existingListing, listingData)
    : listingRepository.create(listingData);
  const savedListing = await listingRepository.save(listing);

  await imageRepository.delete({ listingId: savedListing.id });
  await listingAmenityRepository.delete({ listingId: savedListing.id });

  const images = room.images.map((url, index) =>
    imageRepository.create({
      listingId: savedListing.id,
      url,
      isCover: index === 0,
      sortOrder: index,
    }),
  );
  const listingAmenities = getAmenityIds(room).map((amenityId) =>
    listingAmenityRepository.create({
      listingId: savedListing.id,
      amenityId,
    }),
  );

  await imageRepository.save(images);
  await listingAmenityRepository.save(listingAmenities);

  return { listingId: savedListing.id, room };
}

async function getDistanceToUniversity(
  listingRepository: Repository<Listing>,
  seededRoom: SeededRoom,
): Promise<number> {
  const center = UNIVERSITY_CENTERS[seededRoom.room.universityNearby];
  const result = await listingRepository
    .createQueryBuilder('listing')
    .select(
      'ST_Distance("listing"."location"::geography, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography)',
      'distance',
    )
    .where('listing.id = :listingId', { listingId: seededRoom.listingId })
    .setParameters({
      longitude: center.longitude,
      latitude: center.latitude,
    })
    .getRawOne<DistanceResult>();

  if (!result) {
    throw new Error(
      `Không tính được khoảng cách cho phòng "${seededRoom.room.title}"`,
    );
  }

  return Number(result.distance);
}

async function verifySeededRooms(
  dataSource: DataSource,
  seededRooms: SeededRoom[],
): Promise<void> {
  const listingRepository = dataSource.getRepository(Listing);
  const listingIds = seededRooms.map(({ listingId }) => listingId);
  const listings = await listingRepository.find({
    where: { id: In(listingIds) },
    relations: { images: true, listingAmenities: true },
  });
  const imageUrls = new Set<string>();

  if (listings.length !== EXPECTED_ROOM_COUNT) {
    throw new Error(
      `Cơ sở dữ liệu phải có ${EXPECTED_ROOM_COUNT} phòng mẫu, hiện có ${listings.length} phòng`,
    );
  }

  for (const listing of listings) {
    const coordinates = listing.location.coordinates;

    if (
      !listing.fullAddress ||
      coordinates[0] === 0 ||
      coordinates[1] === 0 ||
      Number(listing.price) % 100000 !== 0 ||
      listing.images.length < 4
    ) {
      throw new Error(`Phòng "${listing.title}" không đạt yêu cầu kiểm tra`);
    }

    for (const image of listing.images) {
      if (imageUrls.has(image.url)) {
        throw new Error(`URL ảnh bị trùng trong cơ sở dữ liệu: ${image.url}`);
      }

      imageUrls.add(image.url);
    }
  }

  for (const seededRoom of seededRooms) {
    const distance = await getDistanceToUniversity(
      listingRepository,
      seededRoom,
    );

    if (distance > MAXIMUM_UNIVERSITY_DISTANCE_METERS) {
      throw new Error(
        `Phòng "${seededRoom.room.title}" cách trường ${Math.round(distance)} m, vượt quá giới hạn`,
      );
    }
  }

  const aggregate = await listingRepository
    .createQueryBuilder('listing')
    .select('COUNT(listing.id)', 'count')
    .addSelect('MIN(listing.price)', 'minimumPrice')
    .addSelect('MAX(listing.price)', 'maximumPrice')
    .getRawOne<AggregateResult>();

  console.log('\nKết quả kiểm tra tương đương:');
  console.log('SELECT COUNT(*), MIN(price), MAX(price) FROM listings;');
  console.log({
    soLuong: Number(aggregate?.count ?? 0),
    giaThapNhat: Number(aggregate?.minimumPrice ?? 0),
    giaCaoNhat: Number(aggregate?.maximumPrice ?? 0),
  });

  console.log('\nBa phòng mẫu:');

  for (const seededRoom of [seededRooms[0], seededRooms[15], seededRooms[33]]) {
    if (!seededRoom) {
      continue;
    }

    const distance = await getDistanceToUniversity(
      listingRepository,
      seededRoom,
    );

    console.log({
      tieuDe: seededRoom.room.title,
      diaChi: seededRoom.room.address,
      gia: seededRoom.room.price,
      khoangCachDenTruong: `${Math.round(distance)} m`,
    });
  }
}

export async function seedRooms(dataSource: DataSource): Promise<void> {
  const rooms = readRoomsData();

  validateRoomsData(rooms);

  const ownerIds = await seedLandlords(dataSource);

  await seedStudent(dataSource);

  const seededRooms = await dataSource.transaction(async (manager) => {
    const results: SeededRoom[] = [];

    for (const room of rooms) {
      results.push(await upsertRoom(manager, room, ownerIds));
    }

    return results;
  });

  await verifySeededRooms(dataSource, seededRooms);

  console.log('\nĐã nạp 55 phòng trọ thành công');
}
