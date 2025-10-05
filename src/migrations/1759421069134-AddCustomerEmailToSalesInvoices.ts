import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomerEmailToSalesInvoices1759421069134 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm cột customer_email vào bảng sales_invoices
        await queryRunner.query(`
            ALTER TABLE "sales_invoices" 
            ADD COLUMN "customer_email" character varying
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa cột customer_email khỏi bảng sales_invoices
        await queryRunner.query(`
            ALTER TABLE "sales_invoices" 
            DROP COLUMN "customer_email"
        `);
    }

}
