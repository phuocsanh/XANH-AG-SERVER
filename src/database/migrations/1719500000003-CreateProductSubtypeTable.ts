import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateProductSubtypeTable1719500000003
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'product_subtype',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'type_id',
            type: 'int',
          },
          {
            name: 'subtype_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'subtype_code',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'description',
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
      'product_subtype',
      new TableForeignKey({
        columnNames: ['type_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'product_type',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa foreign key constraint trước
    const table = await queryRunner.getTable('product_subtype');
    const foreignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('type_id') !== -1,
    );
    await queryRunner.dropForeignKey('product_subtype', foreignKey);

    // Xóa bảng
    await queryRunner.dropTable('product_subtype');
  }
}
