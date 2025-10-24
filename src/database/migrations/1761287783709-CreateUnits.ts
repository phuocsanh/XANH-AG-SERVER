import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUnits1761287783709 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tạo bảng units
    await queryRunner.createTable(
      new Table({
        name: 'units',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'unit_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'unit_code',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'archived'],
            default: `'active'`,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true, // ifNotExists
    );

    // Tạo index cho unit_code
    await queryRunner.createIndex(
      'units',
      new TableIndex({
        name: 'IDX_UNITS_UNIT_CODE',
        columnNames: ['unit_code'],
      }),
    );

    // Tạo index cho status
    await queryRunner.createIndex(
      'units',
      new TableIndex({
        name: 'IDX_UNITS_STATUS',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa index trước
    await queryRunner.dropIndex('units', 'IDX_UNITS_STATUS');
    await queryRunner.dropIndex('units', 'IDX_UNITS_UNIT_CODE');

    // Xóa bảng units
    await queryRunner.dropTable('units');
  }
}
