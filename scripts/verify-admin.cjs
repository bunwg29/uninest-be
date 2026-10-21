const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { NestFactory } = require('@nestjs/core');
const { Client } = require('pg');
require('dotenv').config({ quiet: true });

const testDatabase = `uninest_admin_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const connectionOptions = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
};
const migrationCommand = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'node_modules/typeorm/cli.js'];
let app;
let database;

function migration(action) {
  execFileSync(process.execPath, [...migrationCommand, `migration:${action}`, '-d', 'src/core/database/data-source.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, DB_DATABASE: testDatabase, DB_SYNCHRONIZE: 'false' },
    stdio: 'pipe',
  });
}

async function request(baseUrl, path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const body = await response.json();

  assert.equal(response.status, expectedStatus, `${path}: ${JSON.stringify(body)}`);

  return body.data;
}

async function login(baseUrl, phone) {
  const data = await request(baseUrl, '/auth/login', {
    method: 'POST',
    body: {
      identifier: phone,
      password: 'UniNest@123',
      deviceId: randomUUID(),
    },
  });

  return data.accessToken;
}

async function waitForNotification(prefix, userId) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const result = await database.query(
      'SELECT id, event_key, body, payload FROM notifications WHERE user_id = $1 AND event_key LIKE $2 ORDER BY created_at DESC LIMIT 1',
      [userId, `${prefix}%`],
    );

    if (result.rows[0]) return result.rows[0];

    await delay(100);
  }

  throw new Error(`Không có thông báo ${prefix} sau 10 giây`);
}

async function run() {
  const adminDatabase = new Client({ ...connectionOptions, database: 'postgres' });

  await adminDatabase.connect();

  try {
    await adminDatabase.query(`CREATE DATABASE "${testDatabase}"`);
    process.env.DB_DATABASE = testDatabase;
    process.env.DB_SYNCHRONIZE = 'false';
    migration('run');
    migration('revert');
    migration('run');
    execFileSync(process.execPath, [
      '-r', 'ts-node/register', '-r', 'tsconfig-paths/register',
      'src/core/database/seeders/run-seeder.ts',
    ], { cwd: process.cwd(), env: process.env, stdio: 'pipe' });

    database = new Client({ ...connectionOptions, database: testDatabase });
    await database.connect();

    const { AppModule } = require('../src/app.module');
    const { createGlobalValidationPipe, TransformInterceptor } = require('../src/common');

    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createGlobalValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.listen(0, '127.0.0.1');

    const baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    const [adminToken, studentToken] = await Promise.all([
      login(baseUrl, '0900000299'),
      login(baseUrl, '0900000001'),
    ]);

    await request(baseUrl, '/admin/overview', {}, 401);
    await request(baseUrl, '/admin/overview', { token: studentToken }, 403);

    const pending = await database.query(
      'SELECT id, owner_id FROM listings WHERE status = $1 AND deleted_at IS NULL ORDER BY id LIMIT 2',
      ['pending'],
    );

    assert.equal(pending.rows.length, 2, 'Seed cần ít nhất hai tin chờ duyệt');
    const [approvedListing, rejectedListing] = pending.rows;

    await request(baseUrl, `/admin/listings/${approvedListing.id}/approve`, {
      method: 'PATCH', token: adminToken,
    });
    await request(baseUrl, `/admin/listings/${approvedListing.id}/approve`, {
      method: 'PATCH', token: adminToken,
    }, 409);
    const approvedNotification = await waitForNotification('listing-reviewed:', approvedListing.owner_id);

    assert.equal(approvedNotification.payload.listingId, approvedListing.id);

    await request(baseUrl, `/admin/listings/${rejectedListing.id}/reject`, {
      method: 'PATCH', token: adminToken, body: { reason: 'Ảnh không rõ nội dung' },
    });
    const rejectedNotification = await waitForNotification('listing-reviewed:', rejectedListing.owner_id);

    assert.match(rejectedNotification.body, /Ảnh không rõ nội dung/);

    const landlord = await database.query('SELECT id FROM users WHERE phone = $1', ['0900000201']);
    const landlordId = landlord.rows[0]?.id;

    assert.ok(landlordId, 'Thiếu chủ trọ mẫu');
    await request(baseUrl, `/users/${landlordId}/reports`, {
      method: 'POST', token: studentToken, body: { reason: 'other', note: 'Kiểm thử cảnh báo' },
    }, 201);
    await request(baseUrl, `/users/${landlordId}/reports`, {
      method: 'POST', token: studentToken, body: { reason: 'other' },
    }, 409);

    const report = await database.query(
      'SELECT id FROM reports WHERE entity_type = $1 AND entity_id = $2 LIMIT 1',
      ['user', landlordId],
    );

    assert.ok(report.rows[0], 'Thiếu báo cáo tài khoản');
    await request(baseUrl, `/admin/reports/${report.rows[0].id}/resolve`, {
      method: 'PATCH', token: adminToken, body: { action: 'warn', reason: 'Vui lòng kiểm tra lại nội dung' },
    });
    const warning = await waitForNotification('report-warning:', landlordId);

    assert.match(warning.body, /Vui lòng kiểm tra lại nội dung/);

    const safeUser = await request(baseUrl, `/admin/users/${landlordId}`, { token: adminToken });

    assert.equal('passwordHash' in safeUser, false);
    assert.equal('refreshToken' in safeUser, false);

    await request(baseUrl, `/admin/users/${landlordId}/lock`, {
      method: 'PATCH', token: adminToken, body: { reason: 'Kiểm thử khoá tài khoản' },
    });
    const activeListings = await database.query(
      'SELECT count(*)::int AS count FROM listings WHERE owner_id = $1 AND status = $2',
      [landlordId, 'active'],
    );

    assert.equal(activeListings.rows[0].count, 0, 'Tin đang hiển thị chưa được ẩn');

    const audit = await database.query(
      'SELECT action, count(*)::int AS count FROM audit_logs GROUP BY action',
    );
    const auditCounts = new Map(audit.rows.map((row) => [row.action, row.count]));

    for (const action of ['listing.approve', 'listing.reject', 'report.warn', 'user.lock']) {
      assert.equal(auditCounts.get(action), 1, `Thiếu audit ${action}`);
    }

    process.stdout.write('PASS: migration run/revert/run, guards, moderation, reports, notifications, lock, audit\n');
  } finally {
    await app?.close();
    await database?.end();
    await adminDatabase.query(`DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE)`);
    await adminDatabase.end();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
