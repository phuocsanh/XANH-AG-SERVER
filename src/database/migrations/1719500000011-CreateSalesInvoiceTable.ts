import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateSalesInvoiceTable1719500000011
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sales_invoice',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'invoice_code',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'customer_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'customer_phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'customer_address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'total_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
          },
          {
            name: 'discount_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'final_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'payment_status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
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
      'sales_invoice',
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
    const table = await queryRunner.getTable('sales_invoice');
    const foreignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('created_by_user_id') !== -1,
    );
    await queryRunner.dropForeignKey('sales_invoice', foreignKey);

    // Xóa bảng
    await queryRunner.dropTable('sales_invoice');
  }
}
