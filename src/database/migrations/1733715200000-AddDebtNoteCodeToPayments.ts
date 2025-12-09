import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration thêm debt_note_code vào payments
 * Để frontend dễ hiển thị mã phiếu công nợ liên quan
 */
export class AddDebtNoteCodeToPayments1733715200000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm cột debt_note_code vào bảng payments
        await queryRunner.query(`
            ALTER TABLE "payments" 
            ADD COLUMN IF NOT EXISTS "debt_note_code" VARCHAR(50)
        `);

        await queryRunner.query(`
            COMMENT ON COLUMN "payments"."debt_note_code" IS 'Mã phiếu công nợ liên quan (để hiển thị trên UI)'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa cột debt_note_code khỏi bảng payments
        await queryRunner.query(`
            ALTER TABLE "payments" 
            DROP COLUMN IF EXISTS "debt_note_code"
        `);
    }

}
