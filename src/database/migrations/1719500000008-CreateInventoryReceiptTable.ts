import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateInventoryReceiptTable1719500000008
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inventory_receipt',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'receipt_code',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'supplier',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'received_date',
            type: 'timestamp',
          },
          {
            name: 'total_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
          },
          {
            name: 'created_by_user_id',
            type: 'int',
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
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
        ],
      }),
      true,
    );

    // Tạo foreign key constraint
    await queryRunner.createForeignKey(
      'inventory_receipt',
      new TableForeignKey({
        columnNames: ['created_by_user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa foreign key constraint trước
    const table = await queryRunner.getTable('inventory_receipt');
    const foreignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('created_by_user_id') !== -1,
    );
    await queryRunner.dropForeignKey('inventory_receipt', foreignKey);

    // Xóa bảng
    await queryRunner.dropTable('inventory_receipt');
  }
}
