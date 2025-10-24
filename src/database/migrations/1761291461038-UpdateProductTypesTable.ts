import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class UpdateProductTypesTable1761291461038
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cập nhật cột status trong bảng product_types để sử dụng enum mới
    await queryRunner.changeColumn(
      'product_types',
      'status',
      new TableColumn({
        name: 'status',
        type: 'enum',
        enum: ['active', 'inactive', 'archived'],
        default: `'active'`,
      }),
    );

    // Tạo hoặc cập nhật index cho cột status
    const table = await queryRunner.getTable('product_types');
    const statusIndex = table!.indices.find(
      (index) => index.name === 'IDX_PRODUCT_TYPES_STATUS',
    );

    if (statusIndex) {
      await queryRunner.dropIndex('product_types', 'IDX_PRODUCT_TYPES_STATUS');
    }

    await queryRunner.createIndex(
      'product_types',
      new TableIndex({
        name: 'IDX_PRODUCT_TYPES_STATUS',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Trở về cấu trúc cũ nếu cần
    await queryRunner.changeColumn(
      'product_types',
      'status',
      new TableColumn({
        name: 'status',
        type: 'enum',
        enum: ['active', 'inactive', 'archived'],
        default: `'active'`,
      }),
    );
  }
}
