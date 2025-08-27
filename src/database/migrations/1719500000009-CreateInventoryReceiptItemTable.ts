import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateInventoryReceiptItemTable1719500000009
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inventory_receipt_item',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'receipt_id',
            type: 'int',
          },
          {
            name: 'product_id',
            type: 'int',
          },
          {
            name: 'quantity',
            type: 'int',
          },
          {
            name: 'unit_cost_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'total_cost_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
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

    // Tạo foreign key constraints
    await queryRunner.createForeignKey(
      'inventory_receipt_item',
      new TableForeignKey({
        columnNames: ['receipt_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'inventory_receipt',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'inventory_receipt_item',
      new TableForeignKey({
        columnNames: ['product_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'product',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa foreign key constraints trước
    const table = await queryRunner.getTable('inventory_receipt_item');

    const receiptForeignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('receipt_id') !== -1,
    );
    await queryRunner.dropForeignKey(
      'inventory_receipt_item',
      receiptForeignKey,
    );

    const productForeignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('product_id') !== -1,
    );
    await queryRunner.dropForeignKey(
      'inventory_receipt_item',
      productForeignKey,
    );

    // Xóa bảng
    await queryRunner.dropTable('inventory_receipt_item');
  }
}
