import * as bcrypt from 'bcryptjs';
import { UserRoleType } from '@common/constants';
import { Conversation, Message, MessageType } from '@modules/chat/entities';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { Province, Ward } from '@modules/locations/entities';
import { User } from '@modules/users/entities';
import { DataSource } from 'typeorm';
import { seedRbac } from './rbac.seeder';

const DEMO_PASSWORD = 'UniNest@123';
const PASSWORD_HASH_ROUNDS = 10;

const DEMO_LANDLORD = {
  phone: '0900000201',
  email: 'chutro.demo@uninest.local',
  fullName: 'Lê Thị Hà',
};

const DEMO_STUDENT = {
  phone: '0900000202',
  email: 'sinhvien.demo@uninest.local',
  fullName: 'Nguyễn Văn An',
};

const DEMO_LISTING = {
  title: 'Phòng mới xây có gác lửng gần ĐHQG',
  description:
    'Phòng 20m2 có gác lửng, wifi, chỗ để xe, giờ giấc tự do. Điện 3.500đ/kWh, nước 100k/người/tháng.',
  roomType: 'phong_tro',
  price: '2500000',
  deposit: '2500000',
  electricPrice: '3500',
  waterPrice: '100000',
  area: '20.00',
  maxOccupants: 2,
  streetAddress: '12 Đường số 6, Linh Trung',
  fullAddress: '12 Đường số 6, Phường Linh Trung, Thành phố Thủ Đức, TP.HCM',
  longitude: 106.7717,
  latitude: 10.87,
};

const DEMO_CONVERSATION = [
  {
    from: 'student',
    content: 'Dạ chào cô, em là sinh viên ĐHQG. Phòng này còn trống không ạ?',
  },
  { from: 'landlord', content: 'Còn em nhé. Phòng có gác, ở được 2 bạn.' },
  {
    from: 'landlord',
    content: 'Điện 3.500đ/kWh, nước 100k/người/tháng. Cọc 1 tháng em nha.',
  },
] as const;

async function ensureLocation(
  dataSource: DataSource,
): Promise<{ provinceCode: string; wardCode: string }> {
  const wardRepository = dataSource.getRepository(Ward);
  const provinceRepository = dataSource.getRepository(Province);
  const existingWard = await wardRepository.findOne({ where: {} });

  if (existingWard) {
    return {
      provinceCode: existingWard.provinceCode,
      wardCode: existingWard.code,
    };
  }

  await provinceRepository.save(
    provinceRepository.create({
      code: '79',
      name: 'Hồ Chí Minh',
      fullName: 'Thành phố Hồ Chí Minh',
      codeName: 'ho_chi_minh',
    }),
  );

  await wardRepository.save(
    wardRepository.create({
      code: '26878',
      name: 'Linh Trung',
      fullName: 'Phường Linh Trung',
      codeName: 'linh_trung',
      provinceCode: '79',
      postalCode: null,
    }),
  );

  return { provinceCode: '79', wardCode: '26878' };
}

async function ensureUser(
  dataSource: DataSource,
  data: { phone: string; email: string; fullName: string },
  roleId: UserRoleType,
): Promise<User> {
  const userRepository = dataSource.getRepository(User);
  const existing = await userRepository.findOne({
    where: { phone: data.phone },
  });

  if (existing) {
    return existing;
  }

  return userRepository.save(
    userRepository.create({
      ...data,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, PASSWORD_HASH_ROUNDS),
      roleId,
      isActive: true,
      isVerified: true,
      phoneVerified: true,
    }),
  );
}

async function ensureListing(
  dataSource: DataSource,
  ownerId: string,
): Promise<Listing> {
  const listingRepository = dataSource.getRepository(Listing);
  const existing = await listingRepository.findOne({
    where: { ownerId, title: DEMO_LISTING.title },
  });

  if (existing) {
    existing.status = ListingStatus.ACTIVE;

    return listingRepository.save(existing);
  }

  const { provinceCode, wardCode } = await ensureLocation(dataSource);
  const { longitude, latitude, ...listingData } = DEMO_LISTING;

  return listingRepository.save(
    listingRepository.create({
      ...listingData,
      ownerId,
      provinceCode,
      wardCode,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      status: ListingStatus.ACTIVE,
    }),
  );
}

async function ensureConversation(
  dataSource: DataSource,
  listing: Listing,
  student: User,
  landlord: User,
): Promise<void> {
  const conversationRepository = dataSource.getRepository(Conversation);
  const messageRepository = dataSource.getRepository(Message);

  const conversation =
    (await conversationRepository.findOne({
      where: { listingId: listing.id, studentId: student.id },
    })) ??
    (await conversationRepository.save(
      conversationRepository.create({
        listingId: listing.id,
        studentId: student.id,
        landlordId: landlord.id,
      }),
    ));

  if (
    await messageRepository.count({
      where: { conversationId: conversation.id },
    })
  ) {
    return;
  }

  const startedAt = Date.now() - DEMO_CONVERSATION.length * 60 * 1000;
  let lastCreatedAt = new Date(startedAt);

  for (const [index, entry] of DEMO_CONVERSATION.entries()) {
    lastCreatedAt = new Date(startedAt + index * 60 * 1000);

    await messageRepository.save(
      messageRepository.create({
        conversationId: conversation.id,
        senderId: entry.from === 'student' ? student.id : landlord.id,
        clientMessageId: crypto.randomUUID(),
        type: MessageType.TEXT,
        content: entry.content,
        imageKeys: [],
        createdAt: lastCreatedAt,
      }),
    );
  }

  await conversationRepository.update(conversation.id, {
    lastMessageAt: lastCreatedAt,
  });
}

export async function seedChatDemo(dataSource: DataSource): Promise<void> {
  await seedRbac(dataSource);

  const landlord = await ensureUser(
    dataSource,
    DEMO_LANDLORD,
    UserRoleType.LANDLORD,
  );
  const student = await ensureUser(
    dataSource,
    DEMO_STUDENT,
    UserRoleType.STUDENT,
  );
  const listing = await ensureListing(dataSource, landlord.id);

  await ensureConversation(dataSource, listing, student, landlord);

  console.log('\n[Chat seeder] Chat demo data created:');
  console.log(
    `  Landlord: ${DEMO_LANDLORD.phone} / ${DEMO_PASSWORD} (${DEMO_LANDLORD.fullName})`,
  );
  console.log(
    `  Student : ${DEMO_STUDENT.phone} / ${DEMO_PASSWORD} (${DEMO_STUDENT.fullName})`,
  );
  console.log(`  Active listing: "${listing.title}" (${listing.id})`);
}
