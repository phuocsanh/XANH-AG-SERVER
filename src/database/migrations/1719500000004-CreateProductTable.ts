import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateProductTable1719500000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'product',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'product_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'product_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'product_status',
            type: 'int',
            default: 1,
          },
          {
            name: 'product_thumb',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'product_description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'product_quantity',
            type: 'int',
            default: 0,
          },
          {
            name: 'product_type',
            type: 'int',
          },
          {
            name: 'discount',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'product_discounted_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'product_selled',
            type: 'int',
            default: 0,
          },
          {
            name: 'is_draft',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_published',
            type: 'boolean',
            default: false,
          },
          {
            name: 'average_cost_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'profit_margin_percent',
            type: 'decimal',
            precision: 5,
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

    // Tạo foreign key constraint
    await queryRunner.createForeignKey(
      'product',
      new TableForeignKey({
        columnNames: ['product_type'],
        referencedColumnNames: ['id'],
        referencedTableName: 'product_type',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa foreign key constraint trước
    const table = await queryRunner.getTable('product');
    const foreignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('product_type') !== -1,
    );
    await queryRunner.dropForeignKey('product', foreignKey);

    // Xóa bảng
    await queryRunner.dropTable('product');
  }
}
