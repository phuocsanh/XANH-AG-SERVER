import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration thêm trường gift_value vào bảng sales_invoices và rice_crops
 * - sales_invoices.gift_value: Giá trị quà tặng khi bán hàng
 * - rice_crops.gift_value: Giá trị quà tặng cuối vụ (khi chốt sổ công nợ)
 */
export class AddGiftValueToInvoicesAndRiceCrops1733713165000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm cột gift_value vào bảng sales_invoices
        await queryRunner.query(`
            ALTER TABLE "sales_invoices" 
            ADD COLUMN IF NOT EXISTS "gift_value" DECIMAL(10,2) DEFAULT 0
        `);

        await queryRunner.query(`
            COMMENT ON COLUMN "sales_invoices"."gift_value" IS 'Giá trị quà tặng quy đổi ra tiền, trừ vào lợi nhuận'
        `);

        // Thêm cột gift_value vào bảng rice_crops
        await queryRunner.query(`
            ALTER TABLE "rice_crops" 
            ADD COLUMN IF NOT EXISTS "gift_value" DECIMAL(10,2) DEFAULT 0
        `);

        await queryRunner.query(`
            COMMENT ON COLUMN "rice_crops"."gift_value" IS 'Giá trị quà tặng cuối vụ quy đổi ra tiền, trừ vào lợi nhuận vụ lúa'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa cột gift_value khỏi bảng sales_invoices
        await queryRunner.query(`
            ALTER TABLE "sales_invoices" 
            DROP COLUMN IF EXISTS "gift_value"
        `);

        // Xóa cột gift_value khỏi bảng rice_crops
        await queryRunner.query(`
            ALTER TABLE "rice_crops" 
            DROP COLUMN IF EXISTS "gift_value"
        `);
    }

}
