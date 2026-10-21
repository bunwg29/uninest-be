const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { NestFactory } = require('@nestjs/core');
const { EventEmitter2 } = require('@nestjs/event-emitter');
const { Queue } = require('bullmq');
const { Client } = require('pg');
require('dotenv').config();
const { AppModule } = require('../src/app.module');

const database = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
const queue = new Queue('notifications', {
  connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
});
const notificationKeys = [];
const savedSearchIds = [];
let app;

async function count(eventKey) {
  const result = await database.query(
    'select count(*)::int as count from notifications where event_key = $1',
    [eventKey],
  );

  return result.rows[0].count;
}

async function waitFor(eventKey) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if ((await count(eventKey)) === 1) return;

    await delay(100);
  }

  throw new Error(`Không có thông báo cho ${eventKey} sau 10 giây`);
}

async function addSavedSearch(userId, criteria) {
  const result = await database.query(
    'insert into saved_searches(user_id,name,criteria,enabled) values ($1,$2,$3,true) returning id',
    [userId, 'Kiểm thử sự kiện', JSON.stringify(criteria)],
  );

  savedSearchIds.push(result.rows[0].id);
}

async function run() {
  await database.connect();

  try {
    const users = await database.query(
      'select id,phone from users where phone = any($1::text[])',
      [['0900000001', '0900000201', '0900000211']],
    );
    const byPhone = new Map(users.rows.map((user) => [user.phone, user.id]));
    const studentId = byPhone.get('0900000001');
    const landlordId = byPhone.get('0900000201');
    const otherStudentId = byPhone.get('0900000211');

    assert.ok(studentId && landlordId && otherStudentId, 'Thiếu tài khoản seed');

    const devices = await database.query(
      'select count(*)::int as count from push_devices where user_id = any($1::uuid[])',
      [[studentId, landlordId, otherStudentId]],
    );

    assert.equal(devices.rows[0].count, 0, 'Có thiết bị thật, không gửi thông báo kiểm thử');

    const listingResult = await database.query(
      'select id,title from listings where status = $1 and deleted_at is null order by id limit 1',
      ['active'],
    );
    const listing = listingResult.rows[0];

    assert.ok(listing, 'Thiếu tin đang hiển thị để thử bộ lọc');
    await addSavedSearch(studentId, { keyword: listing.title.toUpperCase() });
    await addSavedSearch(otherStudentId, { maxPrice: 1 });

    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const events = app.get(EventEmitter2);
    const messageId = randomUUID();
    const conversationId = randomUUID();
    const messageKey = `message:${messageId}`;

    notificationKeys.push(messageKey);
    events.emit('message.created', {
      recipientId: landlordId,
      participantIds: [studentId, landlordId],
      listingId: listing.id,
      message: {
        id: messageId,
        conversationId,
        content: 'Nội dung kiểm thử',
      },
    });
    await waitFor(messageKey);

    const bookingId = randomUUID();
    const bookingCreatedKey = `booking-created:${bookingId}`;

    notificationKeys.push(bookingCreatedKey);
    events.emit('booking.created', {
      bookingId,
      listingId: listing.id,
      studentId,
      landlordId,
      from: null,
      to: 'pending',
      actor: 'student',
    });
    await waitFor(bookingCreatedKey);

    const bookingChangedKey = `booking-status:${bookingId}:pending:confirmed:${studentId}`;
    const bookingChanged = {
      bookingId,
      listingId: listing.id,
      studentId,
      landlordId,
      from: 'pending',
      to: 'confirmed',
      actor: 'landlord',
    };

    notificationKeys.push(bookingChangedKey);
    events.emit('booking.status_changed', bookingChanged);
    await waitFor(bookingChangedKey);
    events.emit('booking.status_changed', bookingChanged);
    await delay(300);
    assert.equal(await count(bookingChangedKey), 1, 'Đổi trạng thái bị thông báo trùng');

    const paymentId = randomUUID();
    const paymentKeys = [
      `payment:${paymentId}:${studentId}`,
      `payment:${paymentId}:${landlordId}`,
    ];

    notificationKeys.push(...paymentKeys);
    events.emit('payment.completed', {
      transactionId: paymentId,
      bookingId,
      payerId: studentId,
      landlordId,
      amount: 1_000_000,
      purpose: 'deposit',
    });
    await Promise.all(paymentKeys.map(waitFor));

    const listingKey = `listing:${listing.id}:${studentId}`;
    const unmatchedKey = `listing:${listing.id}:${otherStudentId}`;

    notificationKeys.push(listingKey, unmatchedKey);
    events.emit('listing.activated', { listingId: listing.id });
    await waitFor(listingKey);
    assert.equal(await count(unmatchedKey), 0, 'Bộ lọc không phù hợp vẫn được gửi');

    process.stdout.write('PASS: chat, booking, payment, bộ lọc, chống trùng và lưu khi không có thiết bị\n');
  } finally {
    await app?.close();

    for (const eventKey of notificationKeys) {
      const job = await queue.getJob(eventKey.replaceAll(':', '-'));

      if (job && (await job.getState()) === 'completed') await job.remove();
    }

    if (notificationKeys.length > 0) {
      await database.query('delete from notifications where event_key = any($1::text[])', [
        notificationKeys,
      ]);
    }

    if (savedSearchIds.length > 0) {
      await database.query('delete from saved_searches where id = any($1::uuid[])', [
        savedSearchIds,
      ]);
    }

    await queue.close();
    await database.end();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
