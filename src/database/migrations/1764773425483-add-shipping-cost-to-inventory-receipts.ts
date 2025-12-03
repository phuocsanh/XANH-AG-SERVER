import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShippingCostToInventoryReceipts1764773425483 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm cột vào bảng inventory_receipts
        await queryRunner.query(`ALTER TABLE "inventory_receipts" ADD COLUMN "shared_shipping_cost" DECIMAL(15,2) DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "inventory_receipts" ADD COLUMN "shipping_allocation_method" VARCHAR(20) DEFAULT 'by_value'`);
        
        // Thêm cột vào bảng inventory_receipt_items
        await queryRunner.query(`ALTER TABLE "inventory_receipt_items" ADD COLUMN "individual_shipping_cost" DECIMAL(15,2) DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "inventory_receipt_items" ADD COLUMN "allocated_shipping_cost" DECIMAL(15,2) DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "inventory_receipt_items" ADD COLUMN "final_unit_cost" DECIMAL(15,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa cột khỏi inventory_receipt_items
        await queryRunner.query(`ALTER TABLE "inventory_receipt_items" DROP COLUMN "final_unit_cost"`);
        await queryRunner.query(`ALTER TABLE "inventory_receipt_items" DROP COLUMN "allocated_shipping_cost"`);
        await queryRunner.query(`ALTER TABLE "inventory_receipt_items" DROP COLUMN "individual_shipping_cost"`);
        
        // Xóa cột khỏi inventory_receipts
        await queryRunner.query(`ALTER TABLE "inventory_receipts" DROP COLUMN "shipping_allocation_method"`);
        await queryRunner.query(`ALTER TABLE "inventory_receipts" DROP COLUMN "shared_shipping_cost"`);
    }

}
