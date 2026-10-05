import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import {
  AllExceptionsFilter,
  HttpExceptionFilter,
  LoggingInterceptor,
  TransformInterceptor,
  createGlobalValidationPipe,
} from '../src/common';
import { JwtAuthGuard } from '../src/common/guards';
import {
  Booking,
  BookingEvent,
  BookingStatus,
} from '../src/modules/booking/entities';
import { BookingExpirationService } from '../src/modules/booking/services';
import { Listing, ListingStatus } from '../src/modules/listings/entities';
import { User } from '../src/modules/users/entities';
import { UserRoleType } from '../src/common/constants';

describe('Booking API', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let listing: Listing;
  let student: User;
  let sequence = 0;

  const asUser = (userId: string) => ({ 'x-test-user-id': userId });
  const futureTime = (days: number, hour: number) => {
    const date = new Date();

    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);

    return date.toISOString();
  };
  const createPayload = (startTime = futureTime(10, 8)) => ({
    listingId: listing.id,
    startTime,
    phone: '0905123456',
    note: 'Kiểm thử tích hợp đặt lịch',
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              user?: unknown;
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          const userId = req.headers['x-test-user-id'];

          req.user = { userId };

          return Boolean(userId);
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createGlobalValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());
    app.useGlobalInterceptors(
      new LoggingInterceptor(),
      new TransformInterceptor(),
    );
    await app.init();

    dataSource = app.get(DataSource);
    listing = await dataSource.getRepository(Listing).findOneOrFail({
      where: { status: ListingStatus.ACTIVE },
    });
    sequence = Date.now() % 1_000_000;
    student = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: `booking-test-${sequence}@uninest.local`,
        phone: `091${String(sequence).padStart(7, '0').slice(-7)}`,
        fullName: 'Sinh viên kiểm thử Booking',
        roleId: UserRoleType.STUDENT,
        isActive: true,
        isVerified: true,
        phoneVerified: true,
      }),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized && student) {
      const bookingIds = (
        await dataSource
          .getRepository(Booking)
          .find({ where: { userId: student.id }, withDeleted: true })
      ).map((booking) => booking.id);

      if (bookingIds.length > 0) {
        await dataSource
          .getRepository(BookingEvent)
          .createQueryBuilder()
          .delete()
          .where('booking_id IN (:...bookingIds)', { bookingIds })
          .execute();
        await dataSource
          .getRepository(Booking)
          .createQueryBuilder()
          .delete()
          .where('id IN (:...bookingIds)', { bookingIds })
          .execute();
      }

      await dataSource.getRepository(User).delete(student.id);
    }

    await app?.close();
  });

  it('trả toàn bộ phòng từ cơ sở dữ liệu và chi tiết phòng', async () => {
    const roomCount = await dataSource.getRepository(Listing).count();
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/rooms')
      .expect(200);

    expect(listResponse.body.data).toHaveLength(roomCount);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${listing.id}`)
      .expect(200);

    expect(detailResponse.body.data).toMatchObject({
      id: listing.id,
      title: listing.title,
      isActive: true,
    });
  });

  it('trả 404 khi phòng không tồn tại', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/rooms/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .expect(404);
  });

  it('tạo booking pending và từ chối phòng không tồn tại', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(asUser(student.id))
      .send(createPayload(futureTime(11, 8)))
      .expect(201);

    expect(created.body.data.status).toBe(BookingStatus.PENDING);
    expect(new Date(created.body.data.expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );

    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(asUser(student.id))
      .send({
        ...createPayload(futureTime(12, 8)),
        listingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      })
      .expect(404);
  });

  it('chỉ cho một trong hai request đồng thời chiếm cùng slot', async () => {
    const payload = createPayload(futureTime(13, 9));
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set(asUser(student.id))
        .send(payload),
      request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set(asUser(student.id))
        .send(payload),
    ]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([201, 409]);
    expect(
      responses.find((response) => response.status === 409)?.body.error,
    ).toBe('SLOT_TAKEN');
  });

  it('xác nhận pending, giữ chỗ và xác nhận holding', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(asUser(student.id))
      .send(createPayload(futureTime(14, 10)))
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${first.body.data.id}/confirm`)
      .set(asUser(listing.ownerId))
      .expect(200)
      .expect(({ body }) =>
        expect(body.data.status).toBe(BookingStatus.CONFIRMED),
      );

    const second = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(asUser(student.id))
      .send(createPayload(futureTime(15, 11)))
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${second.body.data.id}/hold`)
      .set(asUser(student.id))
      .expect(200)
      .expect(({ body }) =>
        expect(body.data.status).toBe(BookingStatus.HOLDING),
      );
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${second.body.data.id}/confirm`)
      .set(asUser(listing.ownerId))
      .expect(200)
      .expect(({ body }) =>
        expect(body.data.status).toBe(BookingStatus.CONFIRMED),
      );
  });

  it('bắt buộc lý do hủy dưới 24 giờ', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(asUser(student.id))
      .send(createPayload(futureTime(0, new Date().getHours() + 2)))
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/bookings/${created.body.data.id}`)
      .set(asUser(student.id))
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/api/v1/bookings/${created.body.data.id}`)
      .set(asUser(student.id))
      .send({ reason: 'Có lịch học đột xuất' })
      .expect(200)
      .expect(({ body }) =>
        expect(body.data.status).toBe(BookingStatus.CANCELLED),
      );
  });

  it('cron hết hạn đúng và chạy lặp idempotent', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(asUser(student.id))
      .send(createPayload(futureTime(16, 13)))
      .expect(201);
    const activePending = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(asUser(student.id))
      .send(createPayload(futureTime(17, 14)))
      .expect(201);
    const activeConfirmed = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(asUser(student.id))
      .send(createPayload(futureTime(18, 15)))
      .expect(201);
    const activeHolding = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set(asUser(student.id))
      .send(createPayload(futureTime(19, 16)))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${activeConfirmed.body.data.id}/confirm`)
      .set(asUser(listing.ownerId))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${activeHolding.body.data.id}/hold`)
      .set(asUser(student.id))
      .expect(200);
    await dataSource.getRepository(Booking).update(created.body.data.id, {
      expiresAt: new Date(Date.now() - 60_000),
    });
    const cron = app.get(BookingExpirationService);

    await expect(cron.handleExpiredBookings()).resolves.toBeGreaterThanOrEqual(
      1,
    );
    await expect(cron.handleExpiredBookings()).resolves.toBe(0);

    const expired = await dataSource
      .getRepository(Booking)
      .findOneByOrFail({ id: created.body.data.id });
    const untouched = await dataSource.getRepository(Booking).findBy({
      id: In([
        activePending.body.data.id,
        activeConfirmed.body.data.id,
        activeHolding.body.data.id,
      ]),
    });

    expect(expired.status).toBe(BookingStatus.EXPIRED);
    expect(untouched.map(({ status }) => status).sort()).toEqual(
      [
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
        BookingStatus.HOLDING,
      ].sort(),
    );
    await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${expired.id}/confirm`)
      .set(asUser(listing.ownerId))
      .expect(409);
  });

  it('trả danh sách và chi tiết có timeline', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/bookings?page=1&limit=50')
      .set(asUser(student.id))
      .expect(200);

    expect(list.body.data.items.length).toBeGreaterThan(0);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${list.body.data.items[0].id}`)
      .set(asUser(student.id))
      .expect(200);

    expect(detail.body.data.events.length).toBeGreaterThan(0);
  });
});
