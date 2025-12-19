import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration thêm column images vào bảng inventory_receipts và inventory_returns
 * Chuyển từ hệ thống file_references sang JSON column đơn giản hơn
 */
export class AddImagesToReceiptsAndReturns1766160000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Thêm column images vào inventory_receipts
    await queryRunner.addColumn(
      'inventory_receipts',
      new TableColumn({
        name: 'images',
        type: 'json',
        isNullable: true,
        comment: 'Danh sách URL hình ảnh hóa đơn / chứng từ',
      }),
    );

    // Thêm column images vào inventory_returns
    await queryRunner.addColumn(
      'inventory_returns',
      new TableColumn({
        name: 'images',
        type: 'json',
        isNullable: true,
        comment: 'Danh sách URL hình ảnh hàng lỗi / chứng từ',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa column images từ inventory_receipts
    await queryRunner.dropColumn('inventory_receipts', 'images');
    
    // Xóa column images từ inventory_returns
    await queryRunner.dropColumn('inventory_returns', 'images');
  }
}
