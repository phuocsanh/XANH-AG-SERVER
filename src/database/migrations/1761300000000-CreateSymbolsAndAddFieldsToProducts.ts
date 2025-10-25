import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class CreateSymbolsAndAddFieldsToProducts1761300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tạo bảng symbols
    await queryRunner.createTable(
      new Table({
        name: 'symbols',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'symbol_code',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'symbol_name',
            type: 'varchar',
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
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Thêm cột symbol_id vào bảng products
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'symbol_id',
        type: 'integer',
        isNullable: true,
      }),
    );

    // Thêm khóa ngoại từ products.symbol_id đến symbols.id
    await queryRunner.createForeignKey(
      'products',
      new TableForeignKey({
        columnNames: ['symbol_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'symbols',
        onDelete: 'SET NULL',
      }),
    );

    // Thêm cột ingredient vào bảng products
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'ingredient',
        type: 'text',
        isArray: true,
        default: 'ARRAY[]::text[]',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa cột ingredient từ bảng products
    await queryRunner.dropColumn('products', 'ingredient');

    // Xóa khóa ngoại từ products.symbol_id
    const table = await queryRunner.getTable('products');
    const foreignKey = table!.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('symbol_id') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('products', foreignKey);
    }

    // Xóa cột symbol_id từ bảng products
    await queryRunner.dropColumn('products', 'symbol_id');

    // Xóa bảng symbols
    await queryRunner.dropTable('symbols');
  }
}
