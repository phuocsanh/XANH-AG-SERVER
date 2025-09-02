import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameProductTableToProducts1719500000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Đổi tên bảng từ 'product' thành 'products'
    await queryRunner.renameTable('product', 'products');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Đổi tên bảng từ 'products' về 'product'
    await queryRunner.renameTable('products', 'product');
  }
}