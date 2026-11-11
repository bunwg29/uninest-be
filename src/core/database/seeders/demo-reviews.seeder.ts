import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Booking, BookingStatus } from '@modules/booking/entities';
import { Review } from '@modules/reviews/entities';
import { User } from '@modules/users/entities';

const BATCH_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_REVIEWS_PER_LISTING = 2;
const MAX_REVIEWS_PER_LISTING = 4;
const MIN_VIEWING_DAYS_AGO = 8;
const VIEWING_DAYS_SPREAD = 80;
const REPLY_RATIO = 0.4;
const EMPTY_COMMENT_RATIO = 0.12;
const EDIT_WINDOW_DAYS = 7;
const FIRST_UUID = '00000000-0000-0000-0000-000000000000';
const PENDING_REVIEW_EVERY = 10;

type Criterion = 'location' | 'value' | 'landlord' | 'amenities';

interface ListingRow {
  id: string;
  ownerId: string;
}

interface ExistingReviewRow {
  listingId: string;
}

interface ExistingBookingRow {
  id: string;
  code: string;
}

const OPENINGS = {
  high: [
    'Phòng đúng như mô tả, mình rất hài lòng.',
    'Đi xem phòng xong là ưng ngay, đáng để thuê.',
    'Trải nghiệm xem phòng rất tốt, mình sẽ cân nhắc thuê.',
    'Phòng sạch sẽ, thoáng mát, chủ trọ nhiệt tình.',
  ],
  mid: [
    'Phòng ở mức ổn, có điểm tốt và điểm cần cải thiện.',
    'Nhìn chung phòng tạm được so với giá.',
    'Phòng khá ổn nhưng vẫn còn vài chỗ mình chưa thật ưng.',
  ],
  low: [
    'Phòng chưa như kỳ vọng của mình sau khi đi xem.',
    'Mình thấy phòng chưa phù hợp với mô tả đăng.',
    'Trải nghiệm xem phòng chưa tốt lắm.',
  ],
} as const;

const PARTS: Record<
  Criterion,
  { good: readonly string[]; bad: readonly string[] }
> = {
  location: {
    good: [
      'Vị trí thuận tiện, đi học và ăn uống đều gần.',
      'Gần trường và có nhiều quán xá xung quanh.',
      'Khu vực yên tĩnh, đi lại dễ dàng.',
    ],
    bad: [
      'Vị trí hơi xa trường, đi lại mất thời gian.',
      'Đường vào phòng nhỏ và hơi khó tìm.',
      'Khu vực khá ồn vào buổi tối.',
    ],
  },
  value: {
    good: [
      'Giá thuê hợp lý so với diện tích và tiện ích.',
      'Chi phí điện nước rõ ràng, không phát sinh thêm.',
      'Giá mềm hơn nhiều phòng cùng khu vực.',
    ],
    bad: [
      'Giá thuê hơi cao so với chất lượng phòng.',
      'Chi phí điện nước tính hơi nhiều.',
      'Mình thấy mức giá chưa tương xứng với diện tích.',
    ],
  },
  landlord: {
    good: [
      'Chủ trọ thân thiện, trả lời tin nhắn nhanh.',
      'Chủ trọ hướng dẫn kỹ và sẵn sàng hỗ trợ sinh viên.',
      'Anh chị chủ trọ dễ nói chuyện, giờ giấc thoải mái.',
    ],
    bad: [
      'Chủ trọ phản hồi hơi chậm.',
      'Mình mong chủ trọ giải thích rõ hơn về nội quy.',
      'Lịch hẹn xem phòng bị đổi giờ khá nhiều lần.',
    ],
  },
  amenities: {
    good: [
      'Tiện ích đầy đủ, máy lạnh và wifi hoạt động tốt.',
      'Có chỗ để xe rộng và khu phơi đồ thoải mái.',
      'Nội thất mới, bếp và nhà vệ sinh sạch sẽ.',
    ],
    bad: [
      'Một số tiện ích đã cũ, cần được bảo trì.',
      'Wifi yếu và chỗ để xe hơi chật.',
      'Nhà vệ sinh và bếp cần được vệ sinh kỹ hơn.',
    ],
  },
};

const REPLIES = {
  positive: [
    'Cảm ơn bạn đã ghé xem phòng và để lại đánh giá. Hy vọng sớm được đón bạn!',
    'Cảm ơn góp ý của bạn, mình sẽ tiếp tục giữ chất lượng phòng thật tốt.',
    'Rất vui vì bạn hài lòng, khi cần hỗ trợ bạn cứ nhắn mình nhé.',
  ],
  negative: [
    'Cảm ơn bạn đã góp ý, mình sẽ cải thiện những điểm bạn nêu.',
    'Xin lỗi vì trải nghiệm chưa tốt, mình đã ghi nhận để điều chỉnh.',
    'Cảm ơn bạn đã dành thời gian xem phòng, mình sẽ sớm khắc phục.',
  ],
} as const;

const NOTES = [
  'Muốn xem phòng vào cuối tuần.',
  'Đi xem cùng bạn cùng phòng.',
  'Cần xem kỹ tiện ích trước khi quyết định.',
];

const CRITERIA: readonly Criterion[] = [
  'location',
  'value',
  'landlord',
  'amenities',
];

const hashString = (value: string): number => {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const createRandom = (seed: number): (() => number) => {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;

    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);

    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length)];

const clampRating = (value: number): number => Math.min(5, Math.max(1, value));

const pickBaseRating = (random: () => number): number => {
  const roll = random();

  if (roll < 0.45) return 5;

  if (roll < 0.8) return 4;

  if (roll < 0.92) return 3;

  if (roll < 0.98) return 2;

  return 1;
};

const buildComment = (
  ratings: Record<Criterion, number>,
  average: number,
  random: () => number,
): string | null => {
  if (random() < EMPTY_COMMENT_RATIO) return null;

  const opening = pick(
    average >= 4 ? OPENINGS.high : average >= 3 ? OPENINGS.mid : OPENINGS.low,
    random,
  );
  const firstIndex = Math.floor(random() * CRITERIA.length);
  const secondIndex =
    (firstIndex + 1 + Math.floor(random() * (CRITERIA.length - 1))) %
    CRITERIA.length;
  const parts = [firstIndex, secondIndex].map((index) => {
    const criterion = CRITERIA[index];
    const rating = ratings[criterion];
    const isGood = rating >= 4 || (rating === 3 && random() < 0.5);

    return pick(PARTS[criterion][isGood ? 'good' : 'bad'], random);
  });

  return [opening, ...parts].join(' ');
};

const buildBookingCode = (listingId: string, studentIndex: number): string =>
  `BK-SEED-${listingId.replaceAll('-', '').slice(0, 12).toUpperCase()}-${studentIndex + 1}`;

export async function seedReviews(
  dataSource: DataSource,
  students: User[],
): Promise<number> {
  if (students.length === 0) return 0;

  let created = 0;
  let lastId = FIRST_UUID;
  const now = Date.now();

  for (;;) {
    const listings = await dataSource.query<ListingRow[]>(
      `SELECT id, owner_id AS "ownerId" FROM listings
       WHERE deleted_at IS NULL AND id > $1
       ORDER BY id LIMIT $2`,
      [lastId, BATCH_SIZE],
    );

    if (listings.length === 0) break;

    lastId = listings[listings.length - 1].id;

    const listingIds = listings.map((listing) => listing.id);
    const reviewed = new Set(
      (
        await dataSource.query<ExistingReviewRow[]>(
          `SELECT DISTINCT listing_id AS "listingId" FROM reviews
           WHERE listing_id = ANY($1::uuid[])`,
          [listingIds],
        )
      ).map((row) => row.listingId),
    );
    const pending = listings.filter((listing) => !reviewed.has(listing.id));

    if (pending.length === 0) continue;

    const plans = pending.flatMap((listing) => {
      const seed = hashString(listing.id);
      const count =
        MIN_REVIEWS_PER_LISTING +
        (seed % (MAX_REVIEWS_PER_LISTING - MIN_REVIEWS_PER_LISTING + 1));
      const offset = seed % students.length;
      const keepPrimaryUnreviewed = seed % PENDING_REVIEW_EVERY === 0;
      const listingPlans = Array.from(
        { length: Math.min(count, students.length) },
        (_, position) => {
          const studentIndex = (offset + position) % students.length;

          return {
            listing,
            student: students[studentIndex],
            studentIndex,
            withReview: !(keepPrimaryUnreviewed && studentIndex === 0),
          };
        },
      ).filter((plan) => plan.student.id !== listing.ownerId);

      if (
        keepPrimaryUnreviewed &&
        !listingPlans.some((plan) => plan.studentIndex === 0)
      ) {
        listingPlans.push({
          listing,
          student: students[0],
          studentIndex: 0,
          withReview: false,
        });
      }

      return listingPlans;
    });

    await dataSource.transaction(async (manager) => {
      const codes = plans.map((plan) =>
        buildBookingCode(plan.listing.id, plan.studentIndex),
      );
      const existingBookings = await manager.query<ExistingBookingRow[]>(
        `SELECT id, code FROM bookings WHERE code = ANY($1::text[])`,
        [codes],
      );
      const bookingIdByCode = new Map(
        existingBookings.map((booking) => [booking.code, booking.id]),
      );
      const newBookings: Booking[] = [];
      const reviews: Review[] = [];

      plans.forEach((plan, index) => {
        const code = codes[index];
        const random = createRandom(hashString(code));
        const startsAt =
          now -
          (MIN_VIEWING_DAYS_AGO + Math.floor(random() * VIEWING_DAYS_SPREAD)) *
            DAY_MS +
          (2 + Math.floor(random() * 9)) * HOUR_MS -
          (now % DAY_MS);
        const endsAt = startsAt + HOUR_MS;
        let bookingId = bookingIdByCode.get(code);

        if (!bookingId) {
          bookingId = randomUUID();
          bookingIdByCode.set(code, bookingId);
          newBookings.push(
            manager.create(Booking, {
              id: bookingId,
              code,
              listingId: plan.listing.id,
              userId: plan.student.id,
              phone: (plan.student.phone ?? '0900000000').slice(0, 10),
              startTime: new Date(startsAt),
              endTime: new Date(endsAt),
              status: BookingStatus.CONFIRMED,
              expiresAt: null,
              note: pick(NOTES, random),
              confirmedAt: new Date(startsAt - 2 * DAY_MS),
              createdAt: new Date(startsAt - 3 * DAY_MS),
              updatedAt: new Date(startsAt - 2 * DAY_MS),
            }),
          );
        }

        if (!plan.withReview) return;

        const base = pickBaseRating(random);
        const ratings: Record<Criterion, number> = {
          location: clampRating(base + pick([-1, 0, 0, 1], random)),
          value: clampRating(base + pick([-1, 0, 0, 1], random)),
          landlord: clampRating(base + pick([-1, 0, 0, 1], random)),
          amenities: clampRating(base + pick([-1, 0, 0, 1], random)),
        };
        const average =
          (ratings.location +
            ratings.value +
            ratings.landlord +
            ratings.amenities) /
          4;
        const createdAt = new Date(
          endsAt + (1 + Math.floor(random() * 3)) * DAY_MS,
        );
        const hasReply = random() < REPLY_RATIO;

        reviews.push(
          manager.create(Review, {
            id: randomUUID(),
            listingId: plan.listing.id,
            bookingId,
            studentId: plan.student.id,
            locationRating: ratings.location,
            valueRating: ratings.value,
            landlordRating: ratings.landlord,
            amenitiesRating: ratings.amenities,
            averageRating: average.toFixed(2),
            comment: buildComment(ratings, average, random),
            editedUntil: new Date(
              createdAt.getTime() + EDIT_WINDOW_DAYS * DAY_MS,
            ),
            landlordReply: hasReply
              ? pick(average >= 3 ? REPLIES.positive : REPLIES.negative, random)
              : null,
            repliedAt: hasReply ? new Date(createdAt.getTime() + DAY_MS) : null,
            createdAt,
            updatedAt: createdAt,
          }),
        );
      });

      if (newBookings.length) {
        await manager.save(Booking, newBookings, {
          chunk: BATCH_SIZE,
          reload: false,
        });
      }

      if (reviews.length) {
        await manager.save(Review, reviews, {
          chunk: BATCH_SIZE,
          reload: false,
        });
      }

      await manager.query(
        `UPDATE listings l
         SET average_rating = summary.average, review_count = summary.total
         FROM (
           SELECT listing_id,
                  ROUND(AVG(average_rating), 2) AS average,
                  COUNT(*)::int AS total
           FROM reviews
           WHERE deleted_at IS NULL AND listing_id = ANY($1::uuid[])
           GROUP BY listing_id
         ) summary
         WHERE l.id = summary.listing_id`,
        [pending.map((listing) => listing.id)],
      );

      created += reviews.length;
    });
  }

  return created;
}
