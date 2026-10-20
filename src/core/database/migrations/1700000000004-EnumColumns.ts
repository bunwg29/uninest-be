import { MigrationInterface, QueryRunner } from 'typeorm';

interface EnumColumn {
  table: string;
  column: string;
  values: string[];
  varcharLength: number;
  prepareSql?: string;
  defaultValue?: string;
}

const ROOM_TYPES = [
  'phong_tro',
  'nha_nguyen_can',
  'chung_cu_mini',
  'ky_tuc_xa',
  'studio',
  'can_ho_dich_vu',
];

const LISTING_REPORT_REASONS = [
  'scam',
  'false_information',
  'wrong_price',
  'already_rented',
  'other',
];

const OTP_TYPES = [
  'REGISTER',
  'LOGIN',
  'FORGOT_PASSWORD',
  'PHONE_CHANGE',
  'EMAIL_CHANGE',
];

const BOOKING_EVENT_TYPES = [
  'created',
  'pending',
  'confirmed',
  'holding',
  'expired',
  'cancelled',
  'rejected',
];

const BOOKING_ACTORS = ['student', 'landlord', 'system'];

const toSqlList = (values: string[]) =>
  values.map((value) => `'${value}'`).join(', ');

const ENUM_COLUMNS: EnumColumn[] = [
  {
    table: 'listings',
    column: 'room_type',
    values: ROOM_TYPES,
    varcharLength: 50,
    prepareSql: `UPDATE "listings" SET "room_type" = CASE
      WHEN "room_type" IN (${toSqlList(ROOM_TYPES)}) THEN "room_type"
      WHEN "room_type" = 'studio_mini' THEN 'studio'
      ELSE 'phong_tro' END`,
  },
  {
    table: 'listing_reports',
    column: 'reason',
    values: LISTING_REPORT_REASONS,
    varcharLength: 30,
    prepareSql: `UPDATE "listing_reports" SET "reason" = 'other'
      WHERE "reason" NOT IN (${toSqlList(LISTING_REPORT_REASONS)})`,
  },
  {
    table: 'otp_codes',
    column: 'type',
    values: OTP_TYPES,
    varcharLength: 20,
    prepareSql: `DELETE FROM "otp_codes" WHERE "type" NOT IN (${toSqlList(OTP_TYPES)})`,
    defaultValue: 'REGISTER',
  },
  {
    table: 'booking_events',
    column: 'event_type',
    values: BOOKING_EVENT_TYPES,
    varcharLength: 50,
  },
  {
    table: 'booking_events',
    column: 'actor',
    values: BOOKING_ACTORS,
    varcharLength: 20,
    prepareSql: `UPDATE "booking_events" SET "actor" = NULL
      WHERE "actor" NOT IN (${toSqlList(BOOKING_ACTORS)})`,
  },
];

const enumName = ({ table, column }: EnumColumn) =>
  `"public"."${table}_${column}_enum"`;

export class EnumColumns1700000000004 implements MigrationInterface {
  name = 'EnumColumns1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const item of ENUM_COLUMNS) {
      const rows = (await queryRunner.query(
        `SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [item.table, item.column],
      )) as { data_type: string }[];

      if (rows[0]?.data_type !== 'character varying') continue;

      if (item.prepareSql) await queryRunner.query(item.prepareSql);

      if (item.defaultValue) {
        await queryRunner.query(
          `ALTER TABLE "${item.table}" ALTER COLUMN "${item.column}" DROP DEFAULT`,
        );
      }

      await queryRunner.query(
        `CREATE TYPE ${enumName(item)} AS ENUM(${toSqlList(item.values)})`,
      );
      await queryRunner.query(
        `ALTER TABLE "${item.table}" ALTER COLUMN "${item.column}" TYPE ${enumName(item)} USING "${item.column}"::text::${enumName(item)}`,
      );

      if (item.defaultValue) {
        await queryRunner.query(
          `ALTER TABLE "${item.table}" ALTER COLUMN "${item.column}" SET DEFAULT '${item.defaultValue}'`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const item of [...ENUM_COLUMNS].reverse()) {
      if (item.defaultValue) {
        await queryRunner.query(
          `ALTER TABLE "${item.table}" ALTER COLUMN "${item.column}" DROP DEFAULT`,
        );
      }

      await queryRunner.query(
        `ALTER TABLE "${item.table}" ALTER COLUMN "${item.column}" TYPE character varying(${item.varcharLength}) USING "${item.column}"::text`,
      );
      await queryRunner.query(`DROP TYPE IF EXISTS ${enumName(item)}`);

      if (item.defaultValue) {
        await queryRunner.query(
          `ALTER TABLE "${item.table}" ALTER COLUMN "${item.column}" SET DEFAULT '${item.defaultValue}'`,
        );
      }
    }
  }
}
