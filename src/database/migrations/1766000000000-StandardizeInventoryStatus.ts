
import { MigrationInterface, QueryRunner } from "typeorm";

export class StandardizeInventoryStatus1766000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Inventory Adjustments
        await queryRunner.query("UPDATE inventory_adjustments SET status = 'draft' WHERE status = '0' OR status IS NULL");
        await queryRunner.query("UPDATE inventory_adjustments SET status = 'approved' WHERE status = '2'");
        await queryRunner.query("UPDATE inventory_adjustments SET status = 'completed' WHERE status = '3'");
        await queryRunner.query("UPDATE inventory_adjustments SET status = 'cancelled' WHERE status = '4'");

        // 2. Inventory Returns
        await queryRunner.query("UPDATE inventory_returns SET status = 'draft' WHERE status = '0' OR status IS NULL");
        await queryRunner.query("UPDATE inventory_returns SET status = 'approved' WHERE status = '2'");
        await queryRunner.query("UPDATE inventory_returns SET status = 'completed' WHERE status = '3'");
        await queryRunner.query("UPDATE inventory_returns SET status = 'cancelled' WHERE status = '4'");

        // 3. Inventory Receipts
        await queryRunner.query("UPDATE inventory_receipts SET status = 'draft' WHERE status = '0' OR status IS NULL");
        await queryRunner.query("UPDATE inventory_receipts SET status = 'approved' WHERE status = '2'");
        await queryRunner.query("UPDATE inventory_receipts SET status = 'completed' WHERE status = '3'");
        await queryRunner.query("UPDATE inventory_receipts SET status = 'cancelled' WHERE status = '4'");

        // 4. Sales Invoices
        await queryRunner.query("UPDATE sales_invoices SET status = 'draft' WHERE status = '0' OR status IS NULL");
        await queryRunner.query("UPDATE sales_invoices SET payment_status = 'pending' WHERE payment_status = '0' OR payment_status IS NULL");

        // 5. Delivery Logs
        await queryRunner.query("UPDATE delivery_logs SET status = 'completed' WHERE status IS NULL OR status = '0'");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback Adjustments
        await queryRunner.query("UPDATE inventory_adjustments SET status = '0' WHERE status = 'draft'");
        await queryRunner.query("UPDATE inventory_adjustments SET status = '2' WHERE status = 'approved'");

        // Rollback Returns
        await queryRunner.query("UPDATE inventory_returns SET status = '0' WHERE status = 'draft'");
        await queryRunner.query("UPDATE inventory_returns SET status = '2' WHERE status = 'approved'");
    }
}
