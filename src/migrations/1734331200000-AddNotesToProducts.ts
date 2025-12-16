import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration để thêm trường notes (ghi chú) vào bảng products
 */
export class AddNotesToProducts1734331200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Thêm column notes vào bảng products
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'notes',
        type: 'text',
        isNullable: true,
        comment: 'Ghi chú về sản phẩm',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa column notes khỏi bảng products
    await queryRunner.dropColumn('products', 'notes');
  }
}
