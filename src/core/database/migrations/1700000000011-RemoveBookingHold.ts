import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveBookingHold1700000000011 implements MigrationInterface {
  name = 'RemoveBookingHold1700000000011';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "bookings" SET "status" = 'confirmed', "expires_at" = NULL WHERE "status" = 'holding'`,
    );
    await queryRunner.query(
      `DELETE FROM "booking_events" WHERE "event_type" = 'holding'`,
    );
    await queryRunner.query(`DROP INDEX "uq_bookings_one_holding_per_listing"`);
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "deposit_amount"`,
    );
    await this.replaceEnum(
      queryRunner,
      'bookings',
      'status',
      ['pending', 'confirmed', 'expired', 'cancelled', 'rejected'],
      'pending',
    );
    await this.replaceEnum(queryRunner, 'booking_events', 'event_type', [
      'created',
      'pending',
      'confirmed',
      'expired',
      'cancelled',
      'rejected',
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.replaceEnum(queryRunner, 'booking_events', 'event_type', [
      'created',
      'pending',
      'confirmed',
      'holding',
      'expired',
      'cancelled',
      'rejected',
    ]);
    await this.replaceEnum(
      queryRunner,
      'bookings',
      'status',
      ['pending', 'confirmed', 'holding', 'expired', 'cancelled', 'rejected'],
      'pending',
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "deposit_amount" numeric(12,0)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_bookings_one_holding_per_listing" ON "bookings" ("listing_id") WHERE "status" = 'holding' AND "deleted_at" IS NULL`,
    );
  }

  private async replaceEnum(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    values: string[],
    defaultValue?: string,
  ): Promise<void> {
    const type = `${table}_${column}_enum`;
    const list = values.map((value) => `'${value}'`).join(', ');

    if (defaultValue) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`,
      );
    }

    await queryRunner.query(`ALTER TYPE "${type}" RENAME TO "${type}_old"`);
    await queryRunner.query(`CREATE TYPE "${type}" AS ENUM (${list})`);
    await queryRunner.query(
      `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE "${type}" USING "${column}"::text::"${type}"`,
    );
    await queryRunner.query(`DROP TYPE "${type}_old"`);

    if (defaultValue) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT '${defaultValue}'`,
      );
    }
  }
}
