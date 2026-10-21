const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { Client } = require('pg');
require('dotenv').config();
const { AppModule } = require('../src/app.module');
const { NotificationQueueService } = require('../src/modules/notifications/services/notification-queue.service');

const baseUrl = `http://127.0.0.1:${process.env.PORT || 3001}/api/v1`;
const password = process.env.E2E_LOGIN_PASSWORD || 'UniNest@123';
const keyPrefix = `integration-${randomUUID()}`;
const testKeys = [];
const sessions = [];
let app;
let notificationQueue;
let savedSearchId;
let originalPreferences;
let hadPreferences = false;
let studentId;
let studentToken;
let landlordToken;

const database = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

async function request(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
  });
  const body = await response.json();

  assert.equal(response.status, expectedStatus, `${path}: ${JSON.stringify(body)}`);

  return body.data;
}

async function login(identifier) {
  const session = await request(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ identifier, password, deviceId: keyPrefix }),
    },
    200,
  );

  sessions.push(session);

  return session.accessToken;
}

async function notificationCount(eventKey) {
  const result = await database.query(
    'select count(*)::int as count from notifications where event_key = $1',
    [eventKey],
  );

  return result.rows[0].count;
}

async function addNotification(type, eventKey, userId) {
  await notificationQueue.enqueue({
    userId,
    eventKey,
    type,
    title: 'Kiểm thử tích hợp',
    body: 'Thông báo thử nghiệm',
    payload: { screen: 'Notifications' },
  });
  testKeys.push(eventKey);
}

async function run() {
  await database.connect();

  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    notificationQueue = app.get(NotificationQueueService);
    studentToken = await login('0900000001');
    landlordToken = await login('0900000201');
    const studentIdResult = await database.query(
      'select id from users where phone = $1',
      ['0900000001'],
    );
    studentId = studentIdResult.rows[0]?.id;

    assert.ok(studentId, 'Không có tài khoản seed Sinh viên');
    const preferenceRows = await database.query(
      'select 1 from notification_preferences where user_id = $1',
      [studentId],
    );

    hadPreferences = preferenceRows.rowCount > 0;

    await request('/notifications', {}, 401);
    await request('/saved-searches', { token: landlordToken }, 403);
    await request('/notifications?type=invalid', { token: studentToken }, 400);
    await request(
      '/saved-searches',
      {
        method: 'POST',
        token: studentToken,
        body: JSON.stringify({ name: 'Bộ lọc lỗi', criteria: { minPrice: -1 } }),
      },
      400,
    );

    originalPreferences = await request('/notifications/preferences', {
      token: studentToken,
    });
    const saved = await request(
      '/saved-searches',
      {
        method: 'POST',
        token: studentToken,
        body: JSON.stringify({
          name: 'Kiểm thử tích hợp',
          criteria: {
            minPrice: 1_000_000,
            maxPrice: 5_000_000,
            roomTypes: 'phong_tro',
            amenities: '6,7',
            universityCodes: 'DDK',
            sortBy: 'relevance',
            page: 1,
            limit: 10,
          },
        }),
      },
      201,
    );
    savedSearchId = saved.id;
    assert.ok(savedSearchId);
    assert.deepEqual(saved.criteria.roomTypes, ['phong_tro']);
    assert.deepEqual(saved.criteria.amenities, [6, 7]);
    const disabled = await request(`/saved-searches/${savedSearchId}`, {
      method: 'PATCH',
      token: studentToken,
      body: JSON.stringify({ enabled: false }),
    });

    assert.equal(disabled.enabled, false);

    await request('/notifications/preferences', {
      method: 'PATCH',
      token: studentToken,
      body: JSON.stringify({ messages: false, reminders: false }),
    });

    const messageKey = `${keyPrefix}-message`;
    await addNotification('message', messageKey, studentId);
    assert.equal(await notificationCount(messageKey), 0);

    const before = await request('/notifications/unread-count', {
      token: studentToken,
    });
    const bookingKey = `${keyPrefix}-booking`;
    await addNotification('booking', bookingKey, studentId);
    assert.equal(await notificationCount(bookingKey), 1);
    const list = await request('/notifications?type=booking', {
      token: studentToken,
    });
    const created = list.items.find((item) => item.eventKey === bookingKey);

    assert.ok(created, 'Không thấy thông báo đặt lịch trong danh sách');
    assert.equal(created.readAt, null);

    const after = await request('/notifications/unread-count', {
      token: studentToken,
    });

    assert.equal(after.count, before.count + 1);
    await request(`/notifications/${created.id}/read`, {
      method: 'PATCH',
      token: landlordToken,
    }, 404);
    await request(`/notifications/${created.id}/read`, {
      method: 'PATCH',
      token: studentToken,
    });

    const finalCount = await request('/notifications/unread-count', {
      token: studentToken,
    });

    assert.equal(finalCount.count, before.count);
    await request(`/notifications/${created.id}/unread`, {
      method: 'PATCH',
      token: studentToken,
    });

    const markedUnread = await request('/notifications/unread-count', {
      token: studentToken,
    });

    assert.equal(markedUnread.count, before.count + 1);
    await request(`/notifications/${created.id}/read`, {
      method: 'PATCH',
      token: studentToken,
    });
    await addNotification('booking', bookingKey, studentId);
    assert.equal(await notificationCount(bookingKey), 1);
    process.stdout.write('PASS: phân quyền, DTO, bộ lọc, cài đặt, danh sách, đã đọc và chống trùng\n');
  } finally {
    if (savedSearchId && studentToken) {
      await request(`/saved-searches/${savedSearchId}`, {
        method: 'DELETE',
        token: studentToken,
      });
    }

    if (originalPreferences && studentToken && hadPreferences) {
      await request('/notifications/preferences', {
        method: 'PATCH',
        token: studentToken,
        body: JSON.stringify({
          newListings: originalPreferences.newListings,
          messages: originalPreferences.messages,
          reminders: originalPreferences.reminders,
          system: originalPreferences.system,
        }),
      });
    }

    if (originalPreferences && studentId && !hadPreferences) {
      await database.query('delete from notification_preferences where user_id = $1', [studentId]);
    }

    if (testKeys.length > 0) {
      await database.query('delete from notifications where event_key = any($1::text[])', [
        testKeys,
      ]);
    }

    for (const session of sessions) {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    }

    await app?.close();
    await database.end();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
