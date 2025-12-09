import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration rollback: Xóa gift_description khỏi rice_crops
 * Vì gift cuối vụ sẽ chuyển sang lưu ở debt_notes
 */
export class RemoveGiftFromRiceCrops1733714000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Xóa cột gift_description khỏi bảng rice_crops
        await queryRunner.query(`
            ALTER TABLE "rice_crops" 
            DROP COLUMN IF EXISTS "gift_description"
        `);

        // Xóa cột gift_value khỏi bảng rice_crops
        await queryRunner.query(`
            ALTER TABLE "rice_crops" 
            DROP COLUMN IF EXISTS "gift_value"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Khôi phục lại các cột nếu cần rollback
        await queryRunner.query(`
            ALTER TABLE "rice_crops" 
            ADD COLUMN IF NOT EXISTS "gift_description" TEXT
        `);

        await queryRunner.query(`
            ALTER TABLE "rice_crops" 
            ADD COLUMN IF NOT EXISTS "gift_value" DECIMAL(10,2) DEFAULT 0
        `);
    }

}
