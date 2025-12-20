import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIconColorToCostItemCategories1734669000000 implements MigrationInterface {
    name = 'AddIconColorToCostItemCategories1734669000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm columns icon, color, is_active vào bảng cost_item_categories
        await queryRunner.query(`ALTER TABLE "cost_item_categories" ADD COLUMN IF NOT EXISTS "icon" varchar(10)`);
        await queryRunner.query(`ALTER TABLE "cost_item_categories" ADD COLUMN IF NOT EXISTS "color" varchar(20)`);
        await queryRunner.query(`ALTER TABLE "cost_item_categories" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa các columns đã thêm
        await queryRunner.query(`ALTER TABLE "cost_item_categories" DROP COLUMN IF EXISTS "is_active"`);
        await queryRunner.query(`ALTER TABLE "cost_item_categories" DROP COLUMN IF EXISTS "color"`);
        await queryRunner.query(`ALTER TABLE "cost_item_categories" DROP COLUMN IF EXISTS "icon"`);
    }
}
