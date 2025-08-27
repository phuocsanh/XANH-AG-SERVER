import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateProductSubtypeRelationTable1719500000005
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'product_subtype_relation',
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
            name: 'subtype_id',
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
      'product_subtype_relation',
      new TableForeignKey({
        columnNames: ['product_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'product',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'product_subtype_relation',
      new TableForeignKey({
        columnNames: ['subtype_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'product_subtype',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa foreign key constraints trước
    const table = await queryRunner.getTable('product_subtype_relation');

    const productForeignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('product_id') !== -1,
    );
    await queryRunner.dropForeignKey(
      'product_subtype_relation',
      productForeignKey,
    );

    const subtypeForeignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('subtype_id') !== -1,
    );
    await queryRunner.dropForeignKey(
      'product_subtype_relation',
      subtypeForeignKey,
    );

    // Xóa bảng
    await queryRunner.dropTable('product_subtype_relation');
  }
}
