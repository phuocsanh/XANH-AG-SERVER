import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveQuantityUnitFromCostItems1734668000000 implements MigrationInterface {
    name = 'RemoveQuantityUnitFromCostItems1734668000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Xóa 3 columns không cần thiết từ bảng cost_items
        await queryRunner.query(`ALTER TABLE "cost_items" DROP COLUMN IF EXISTS "quantity"`);
        await queryRunner.query(`ALTER TABLE "cost_items" DROP COLUMN IF EXISTS "unit"`);
        await queryRunner.query(`ALTER TABLE "cost_items" DROP COLUMN IF EXISTS "unit_price"`);
        
        // Rename purchase_date thành expense_date cho đúng nghĩa
        await queryRunner.query(`ALTER TABLE "cost_items" RENAME COLUMN "purchase_date" TO "expense_date"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback: thêm lại các columns
        await queryRunner.query(`ALTER TABLE "cost_items" RENAME COLUMN "expense_date" TO "purchase_date"`);
        await queryRunner.query(`ALTER TABLE "cost_items" ADD "unit_price" numeric(15,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "cost_items" ADD "unit" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "cost_items" ADD "quantity" numeric(10,2) NOT NULL DEFAULT 1`);
    }
}
