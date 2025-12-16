import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration để thêm column 'code' vào bảng products
 * Code sẽ được tự động generate khi tạo sản phẩm mới
 */
export class AddCodeToProducts1734334000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm column code (nullable tạm thời để migrate data cũ)
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'code',
        type: 'varchar',
        length: '50',
        isNullable: true, // Tạm thời nullable
        isUnique: false, // Tạm thời không unique
      }),
    );

    // 2. Generate code cho các sản phẩm hiện có
    // Format: SP + timestamp + random
    const products = await queryRunner.query(
      `SELECT id FROM products WHERE code IS NULL ORDER BY id`,
    );

    for (const product of products) {
      const code = `SP${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await queryRunner.query(
        `UPDATE products SET code = $1 WHERE id = $2`,
        [code, product.id],
      );
      // Delay nhỏ để tránh duplicate timestamp
      await new Promise(resolve => setTimeout(resolve, 2));
    }

    // 3. Thêm unique constraint
    await queryRunner.query(
      `ALTER TABLE products ADD CONSTRAINT "UQ_products_code" UNIQUE (code)`,
    );

    // 4. Đổi column thành NOT NULL
    await queryRunner.query(
      `ALTER TABLE products ALTER COLUMN code SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa constraint trước
    await queryRunner.query(
      `ALTER TABLE products DROP CONSTRAINT IF EXISTS "UQ_products_code"`,
    );
    
    // Xóa column
    await queryRunner.dropColumn('products', 'code');
  }
}
