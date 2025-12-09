import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration thêm trường gift_description vào bảng sales_invoices và rice_crops
 * Để lưu mô tả quà tặng (tặng gì) thay vì chỉ lưu giá trị
 */
export class AddGiftDescriptionToInvoicesAndRiceCrops1733713800000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm cột gift_description vào bảng sales_invoices
        await queryRunner.query(`
            ALTER TABLE "sales_invoices" 
            ADD COLUMN IF NOT EXISTS "gift_description" TEXT
        `);

        await queryRunner.query(`
            COMMENT ON COLUMN "sales_invoices"."gift_description" IS 'Mô tả quà tặng: VD "1 thùng nước ngọt Coca", "2 bao phân NPK"'
        `);

        // Thêm cột gift_description vào bảng rice_crops
        await queryRunner.query(`
            ALTER TABLE "rice_crops" 
            ADD COLUMN IF NOT EXISTS "gift_description" TEXT
        `);

        await queryRunner.query(`
            COMMENT ON COLUMN "rice_crops"."gift_description" IS 'Mô tả quà tặng cuối vụ: VD "1 bao phân DAP 50kg", "2 chai thuốc trừ sâu"'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa cột gift_description khỏi bảng sales_invoices
        await queryRunner.query(`
            ALTER TABLE "sales_invoices" 
            DROP COLUMN IF EXISTS "gift_description"
        `);

        // Xóa cột gift_description khỏi bảng rice_crops
        await queryRunner.query(`
            ALTER TABLE "rice_crops" 
            DROP COLUMN IF EXISTS "gift_description"
        `);
    }

}
