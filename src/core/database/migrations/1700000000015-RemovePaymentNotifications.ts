import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePaymentNotifications1700000000015 implements MigrationInterface {
  name = 'RemovePaymentNotifications1700000000015';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "notifications" WHERE "type" = 'payment'`,
    );
    await this.replaceTypeEnum(queryRunner, [
      'listing',
      'message',
      'reminder',
      'system',
      'booking',
      'forum',
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.replaceTypeEnum(queryRunner, [
      'listing',
      'message',
      'reminder',
      'system',
      'booking',
      'payment',
      'forum',
    ]);
  }

  private async replaceTypeEnum(
    queryRunner: QueryRunner,
    values: string[],
  ): Promise<void> {
    const list = values.map((value) => `'${value}'`).join(', ');

    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" RENAME TO "notifications_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "notifications_type_enum" AS ENUM (${list})`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "notifications_type_enum" USING "type"::text::"notifications_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "notifications_type_enum_old"`);
  }
}
