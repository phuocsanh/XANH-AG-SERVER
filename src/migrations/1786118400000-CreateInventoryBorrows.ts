import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateInventoryBorrows1786118400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TYPE inventory_borrow_status_enum AS ENUM ('draft', 'approved', 'partial_returned', 'returned', 'converted_to_sale', 'cancelled')",
    );

    await queryRunner.createTable(
      new Table({
        name: 'inventory_borrows',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'code', type: 'varchar', length: '50', isUnique: true },
          { name: 'borrower_customer_id', type: 'int', isNullable: true },
          { name: 'borrower_name', type: 'varchar' },
          { name: 'borrow_date', type: 'date' },
          { name: 'expected_return_date', type: 'date', isNullable: true },
          {
            name: 'status',
            type: 'inventory_borrow_status_enum',
            default: "'draft'",
          },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_by', type: 'int', isNullable: true },
          { name: 'approved_by', type: 'int', isNullable: true },
          { name: 'approved_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'inventory_borrow_items',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'borrow_id', type: 'int' },
          { name: 'product_id', type: 'int' },
          { name: 'batch_id', type: 'int' },
          { name: 'receipt_item_id', type: 'int', isNullable: true },
          {
            name: 'quantity',
            type: 'decimal',
            precision: 15,
            scale: 4,
            default: 0,
          },
          {
            name: 'returned_quantity',
            type: 'decimal',
            precision: 15,
            scale: 4,
            default: 0,
          },
          {
            name: 'converted_to_sale_quantity',
            type: 'decimal',
            precision: 15,
            scale: 4,
            default: 0,
          },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
        ],
      }),
    );

    await queryRunner.createForeignKeys('inventory_borrows', [
      new TableForeignKey({
        columnNames: ['borrower_customer_id'],
        referencedTableName: 'suppliers',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['approved_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createForeignKeys('inventory_borrow_items', [
      new TableForeignKey({
        columnNames: ['borrow_id'],
        referencedTableName: 'inventory_borrows',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['product_id'],
        referencedTableName: 'products',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['batch_id'],
        referencedTableName: 'inventories',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['receipt_item_id'],
        referencedTableName: 'inventory_receipt_items',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('inventory_borrow_items', true);
    await queryRunner.dropTable('inventory_borrows', true);
    await queryRunner.query('DROP TYPE inventory_borrow_status_enum');
  }
}
