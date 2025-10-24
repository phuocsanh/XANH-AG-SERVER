import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class UpdateProductSubtypesTable1761291495314
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cập nhật cột status trong bảng product_subtypes để sử dụng enum mới
    await queryRunner.changeColumn(
      'product_subtypes',
      'status',
      new TableColumn({
        name: 'status',
        type: 'enum',
        enum: ['active', 'inactive', 'archived'],
        default: `'active'`,
      }),
    );

    // Tạo hoặc cập nhật index cho cột status
    const table = await queryRunner.getTable('product_subtypes');
    const statusIndex = table!.indices.find(
      (index) => index.name === 'IDX_PRODUCT_SUBTYPES_STATUS',
    );

    if (statusIndex) {
      await queryRunner.dropIndex(
        'product_subtypes',
        'IDX_PRODUCT_SUBTYPES_STATUS',
      );
    }

    await queryRunner.createIndex(
      'product_subtypes',
      new TableIndex({
        name: 'IDX_PRODUCT_SUBTYPES_STATUS',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Trở về cấu trúc cũ nếu cần
    await queryRunner.changeColumn(
      'product_subtypes',
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
