import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateInventoryTransactionTable1719500000010
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inventory_transaction',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'product_id',
            type: 'int',
          },
          {
            name: 'transaction_type',
            type: 'varchar',
            length: '20',
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
            name: 'remaining_quantity',
            type: 'int',
          },
          {
            name: 'new_average_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'receipt_item_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'reference_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'reference_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_by_user_id',
            type: 'int',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Tạo foreign key constraints
    await queryRunner.createForeignKey(
      'inventory_transaction',
      new TableForeignKey({
        columnNames: ['product_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'product',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'inventory_transaction',
      new TableForeignKey({
        columnNames: ['receipt_item_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'inventory_receipt_item',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'inventory_transaction',
      new TableForeignKey({
        columnNames: ['created_by_user_id'],
        referencedColumnNames: ['user_id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa foreign key constraints trước
    const table = await queryRunner.getTable('inventory_transaction');

    const productForeignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('product_id') !== -1,
    );
    await queryRunner.dropForeignKey(
      'inventory_transaction',
      productForeignKey,
    );

    const receiptItemForeignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('receipt_item_id') !== -1,
    );
    await queryRunner.dropForeignKey(
      'inventory_transaction',
      receiptItemForeignKey,
    );

    const userForeignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('created_by_user_id') !== -1,
    );
    await queryRunner.dropForeignKey('inventory_transaction', userForeignKey);

    // Xóa bảng
    await queryRunner.dropTable('inventory_transaction');
  }
}
