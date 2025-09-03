import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng sales_invoices - hóa đơn bán hàng
 * Migration được tạo tự động bởi script create-individual-migrations.js
 */
export class CreateSalesInvoices1756915774001 implements MigrationInterface {
  name = 'CreateSalesInvoices1756915774001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng sales_invoices...');
    
    // Tạo bảng sales_invoices
    await queryRunner.query(`CREATE TABLE "sales_invoices" ("id" SERIAL NOT NULL, "invoice_code" character varying NOT NULL, "customer_name" character varying NOT NULL, "customer_phone" character varying, "customer_address" character varying, "total_amount" integer NOT NULL, "discount_amount" integer NOT NULL DEFAULT '0', "final_amount" integer NOT NULL, "payment_method" character varying NOT NULL, "payment_status" character varying NOT NULL DEFAULT 'pending', "notes" character varying, "created_by_user_id" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_cd50b1c065389220460f0639c1c" UNIQUE ("invoice_code"), CONSTRAINT "PK_be0576afbf66c353a8a4435a45b" PRIMARY KEY ("id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng sales_invoices...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "sales_invoices"`);
  }
}
