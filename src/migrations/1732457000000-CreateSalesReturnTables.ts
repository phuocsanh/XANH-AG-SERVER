import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateSalesReturnTables1732457000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create sales_returns table
    await queryRunner.createTable(
      new Table({
        name: 'sales_returns',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'code',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'invoice_id',
            type: 'int',
          },
          {
            name: 'customer_id',
            type: 'int',
          },
          {
            name: 'total_refund_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'completed', 'cancelled'],
            default: "'draft'",
          },
          {
            name: 'created_by',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create sales_return_items table
    await queryRunner.createTable(
      new Table({
        name: 'sales_return_items',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'sales_return_id',
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
            name: 'unit_price',
            type: 'decimal',
            precision: 15,
            scale: 2,
          },
          {
            name: 'total_price',
            type: 'decimal',
            precision: 15,
            scale: 2,
          },
        ],
      }),
      true,
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'sales_returns',
      new TableForeignKey({
        columnNames: ['invoice_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sales_invoices',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'sales_returns',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'sales_return_items',
      new TableForeignKey({
        columnNames: ['sales_return_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sales_returns',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'sales_return_items',
      new TableForeignKey({
        columnNames: ['product_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'products',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sales_return_items');
    await queryRunner.dropTable('sales_returns');
  }
}
