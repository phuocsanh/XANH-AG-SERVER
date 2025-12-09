import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration thêm gift_description và gift_value vào debt_notes
 * Để lưu quà tặng khi quyết toán nợ cuối vụ
 */
export class AddGiftToDebtNotes1733714100000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm cột gift_description vào bảng debt_notes
        await queryRunner.query(`
            ALTER TABLE "debt_notes" 
            ADD COLUMN IF NOT EXISTS "gift_description" TEXT
        `);

        await queryRunner.query(`
            COMMENT ON COLUMN "debt_notes"."gift_description" IS 'Mô tả quà tặng khi quyết toán nợ: VD "1 bao phân DAP 50kg", "2 chai thuốc trừ sâu"'
        `);

        // Thêm cột gift_value vào bảng debt_notes
        await queryRunner.query(`
            ALTER TABLE "debt_notes" 
            ADD COLUMN IF NOT EXISTS "gift_value" DECIMAL(10,2) DEFAULT 0
        `);

        await queryRunner.query(`
            COMMENT ON COLUMN "debt_notes"."gift_value" IS 'Giá trị quà tặng quy đổi ra tiền, trừ vào lợi nhuận'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa cột gift_description khỏi bảng debt_notes
        await queryRunner.query(`
            ALTER TABLE "debt_notes" 
            DROP COLUMN IF EXISTS "gift_description"
        `);

        // Xóa cột gift_value khỏi bảng debt_notes
        await queryRunner.query(`
            ALTER TABLE "debt_notes" 
            DROP COLUMN IF EXISTS "gift_value"
        `);
    }

}
