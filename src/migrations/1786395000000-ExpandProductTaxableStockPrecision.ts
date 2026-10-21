import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mở rộng tồn thuế sản phẩm từ numeric(15,2) lên numeric(15,4).
 * Lô hàng (inventories.taxable_remaining_quantity) đã lưu 4 chữ số thập phân,
 * nhưng tồn thuế cấp sản phẩm chỉ lưu 2 chữ số nên các lần xuất lẻ (ví dụ 1g = 0.001kg)
 * bị chặn thay vì ghi được. Đổi sang numeric(15,4) để đồng bộ với lô,
 * vẫn giữ nguyên quy tắc không tự làm tròn số thuế.
 */
export class ExpandProductTaxableStockPrecision1786395000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "taxable_quantity_stock" TYPE numeric(15,4) USING "taxable_quantity_stock"::numeric(15,4)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Hạ scale sẽ làm tròn 2 chữ số; chỉ chạy khi đã đối soát và chấp nhận mất phần lẻ.
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "taxable_quantity_stock" TYPE numeric(15,2) USING ROUND("taxable_quantity_stock"::numeric, 2)`,
    );
  }
}
