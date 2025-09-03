import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng sales_invoice_items - chi tiết hóa đơn bán hàng
 * Migration được tạo tự động bởi script create-individual-migrations.js
 */
export class CreateSalesInvoiceItems1756915775001 implements MigrationInterface {
  name = 'CreateSalesInvoiceItems1756915775001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng sales_invoice_items...');
    
    // Tạo bảng sales_invoice_items
    await queryRunner.query(`CREATE TABLE "sales_invoice_items" ("id" SERIAL NOT NULL, "invoice_id" integer NOT NULL, "product_id" integer NOT NULL, "quantity" integer NOT NULL, "unit_price" integer NOT NULL, "discount_amount" integer NOT NULL DEFAULT '0', "total_price" integer NOT NULL, "notes" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fd69cf6c3d4df27b0a62ddf8137" PRIMARY KEY ("id"))`);
    
    // Thêm foreign key constraints
    await queryRunner.query(`ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "FK_49796d9add1c7aa6b332fd50dbe" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "FK_07bc0d99ebfadb569006a7606b8" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng sales_invoice_items...');
    
    // Xóa foreign key constraints trước
    await queryRunner.query(`ALTER TABLE "sales_invoice_items" DROP CONSTRAINT "FK_49796d9add1c7aa6b332fd50dbe"`);
    await queryRunner.query(`ALTER TABLE "sales_invoice_items" DROP CONSTRAINT "FK_07bc0d99ebfadb569006a7606b8"`);
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "sales_invoice_items"`);
  }
}
