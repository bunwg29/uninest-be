const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { NestFactory } = require('@nestjs/core');
const { Client } = require('pg');
require('dotenv').config();
const { AppModule } = require('../src/app.module');
const { NotificationQueueService } = require('../src/modules/notifications/services/notification-queue.service');

const database = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
const eventKeys = [];
const tokens = [];
const receipts = new Map();
let app;
let mode = 'ok';
let sendCount = 0;
let successfulAdds = 0;

global.fetch = async (url) => {
  if (String(url).endsWith('/send')) {
    sendCount += 1;

    if (mode === 'temporary') {
      return new Response('{}', { status: 429 });
    }

    const id = `ticket-${sendCount}`;

    receipts.set(id, mode === 'invalid'
      ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
      : { status: 'ok' });

    return Response.json({ data: { status: 'ok', id } });
  }

  return Response.json({ data: Object.fromEntries(receipts) });
};

async function state(eventKey) {
  const result = await database.query(
    `select d.status,d.attempts,d.ticket_id from notification_deliveries d
     join notifications n on n.id = d.notification_id where n.event_key = $1`,
    [eventKey],
  );

  return result.rows[0];
}

async function waitForState(eventKey, expected, minAttempts = 0) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const current = await state(eventKey);

    if (current?.status === expected && current.attempts >= minAttempts) {
      return current;
    }

    await delay(100);
  }

  throw new Error(`Không đạt trạng thái ${expected} cho ${eventKey}: ${JSON.stringify({ current: await state(eventKey), sendCount, successfulAdds })}`);
}

async function makeNotification(service, userId, token) {
  const eventKey = `integration-delivery:${randomUUID()}`;

  eventKeys.push(eventKey);
  await database.query(
    'insert into push_devices(user_id,token,platform) values ($1,$2,$3)',
    [userId, token, 'android'],
  );
  tokens.push(token);
  await service.enqueue({
    userId,
    eventKey,
    type: 'system',
    title: 'Kiểm thử',
    body: 'Kiểm thử gửi thông báo',
    payload: { screen: 'Notifications' },
  });

  return eventKey;
}

async function due(eventKey) {
  await database.query(
    `update notification_deliveries set next_attempt_at = now() - interval '1 second'
     where notification_id = (select id from notifications where event_key = $1)`,
    [eventKey],
  );
}

async function run() {
  await database.connect();

  try {
    const result = await database.query(
      'select id from users where phone = $1',
      ['0900000001'],
    );
    const userId = result.rows[0]?.id;

    assert.ok(userId, 'Thiếu tài khoản seed');
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const service = app.get(NotificationQueueService);

    if (process.env.UNINEST_TEST_REDIS === '1') {
      const deadline = Date.now() + 5_000;

      while (service.queueConnection.status !== 'ready' && Date.now() < deadline) {
        await delay(100);
      }

      assert.equal(service.queueConnection.status, 'ready', 'Redis chưa sẵn sàng');
      const add = service.queue.add.bind(service.queue);

      service.queue.add = async (...args) => {
        const job = await add(...args);

        successfulAdds += 1;
        return job;
      };
    }

    const goodToken = `ExpoPushToken[${randomUUID()}]`;
    const goodKey = await makeNotification(service, userId, goodToken);

    await waitForState(goodKey, 'ticketed');
    await due(goodKey);
    await service.checkReceipts();
    assert.equal((await state(goodKey)).status, 'delivered');
    await database.query('delete from push_devices where token = $1', [goodToken]);

    mode = 'temporary';
    const retryToken = `ExpoPushToken[${randomUUID()}]`;
    const retryKey = await makeNotification(service, userId, retryToken);

    await waitForState(retryKey, 'pending', 1);
    assert.deepEqual(
      { status: (await state(retryKey)).status, attempts: (await state(retryKey)).attempts },
      { status: 'pending', attempts: 1 },
    );
    mode = 'ok';
    await due(retryKey);
    await service.recoverDeliveries();
    await waitForState(retryKey, 'ticketed');
    await database.query('delete from push_devices where token = $1', [retryToken]);

    mode = 'invalid';
    const invalidToken = `ExpoPushToken[${randomUUID()}]`;
    const invalidKey = await makeNotification(service, userId, invalidToken);

    await waitForState(invalidKey, 'ticketed');
    await due(invalidKey);
    await service.checkReceipts();
    assert.equal((await state(invalidKey)).status, 'failed');
    const remaining = await database.query(
      'select count(*)::int as count from push_devices where token = $1',
      [invalidToken],
    );

    assert.equal(remaining.rows[0].count, 0);

    if (process.env.UNINEST_TEST_REDIS === '1') {
      assert.ok(successfulAdds >= 3, 'Thông báo không đi qua BullMQ');
    }

    process.stdout.write('PASS: lưu trước Redis, retry, receipt và token hết hiệu lực\n');
  } finally {
    await app?.close();
    await database.query('delete from notifications where event_key = any($1::text[])', [eventKeys]);
    await database.query('delete from push_devices where token = any($1::text[])', [tokens]);
    await database.end();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
