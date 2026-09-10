import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProfileFields1710000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');

    if (!table) {
      return;
    }

    const columns = [
      new TableColumn({
        name: 'phone_verified',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'school',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'bio',
        type: 'varchar',
        length: '300',
        isNullable: true,
      }),
      new TableColumn({
        name: 'interested_areas',
        type: 'text',
        isArray: true,
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      if (!table.findColumnByName(column.name)) {
        await queryRunner.addColumn('users', column);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');

    if (!table) {
      return;
    }

    for (const columnName of [
      'interested_areas',
      'bio',
      'school',
      'phone_verified',
    ]) {
      const column = table.findColumnByName(columnName);

      if (column) {
        await queryRunner.dropColumn('users', column);
      }
    }
  }
}
