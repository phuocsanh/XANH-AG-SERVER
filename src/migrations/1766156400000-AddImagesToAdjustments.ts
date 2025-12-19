import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration thêm column images vào bảng inventory_adjustments
 */
export class AddImagesToAdjustments1766156400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Thêm column images (JSON array) vào bảng inventory_adjustments
    await queryRunner.addColumn(
      'inventory_adjustments',
      new TableColumn({
        name: 'images',
        type: 'json',
        isNullable: true,
        comment: 'Danh sách URL hình ảnh chứng từ / hiện trạng',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa column images
    await queryRunner.dropColumn('inventory_adjustments', 'images');
  }
}
