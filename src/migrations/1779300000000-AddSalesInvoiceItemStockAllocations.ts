import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalesInvoiceItemStockAllocations1779300000000
  implements MigrationInterface
{
  name = 'AddSalesInvoiceItemStockAllocations1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sales_invoice_item_stock_allocations" (
        "id" SERIAL NOT NULL,
        "invoice_id" integer NOT NULL,
        "sales_invoice_item_id" integer NOT NULL,
        "product_id" integer NOT NULL,
        "inventory_batch_id" integer,
        "receipt_item_id" integer,
        "supplier_id" integer,
        "quantity" numeric(15,4) NOT NULL,
        "unit_cost" numeric(15,2) NOT NULL,
        "total_cost" numeric(15,2) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_invoice_item_stock_allocations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_invoice_item_stock_allocations_invoice" ON "sales_invoice_item_stock_allocations" ("invoice_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_invoice_item_stock_allocations_item" ON "sales_invoice_item_stock_allocations" ("sales_invoice_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_invoice_item_stock_allocations_supplier" ON "sales_invoice_item_stock_allocations" ("supplier_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" ADD CONSTRAINT "FK_sales_invoice_item_stock_allocations_invoice" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" ADD CONSTRAINT "FK_sales_invoice_item_stock_allocations_item" FOREIGN KEY ("sales_invoice_item_id") REFERENCES "sales_invoice_items"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" ADD CONSTRAINT "FK_sales_invoice_item_stock_allocations_product" FOREIGN KEY ("product_id") REFERENCES "products"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" ADD CONSTRAINT "FK_sales_invoice_item_stock_allocations_batch" FOREIGN KEY ("inventory_batch_id") REFERENCES "inventories"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" ADD CONSTRAINT "FK_sales_invoice_item_stock_allocations_receipt_item" FOREIGN KEY ("receipt_item_id") REFERENCES "inventory_receipt_items"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" ADD CONSTRAINT "FK_sales_invoice_item_stock_allocations_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" DROP CONSTRAINT "FK_sales_invoice_item_stock_allocations_supplier"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" DROP CONSTRAINT "FK_sales_invoice_item_stock_allocations_receipt_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" DROP CONSTRAINT "FK_sales_invoice_item_stock_allocations_batch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" DROP CONSTRAINT "FK_sales_invoice_item_stock_allocations_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" DROP CONSTRAINT "FK_sales_invoice_item_stock_allocations_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_item_stock_allocations" DROP CONSTRAINT "FK_sales_invoice_item_stock_allocations_invoice"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_sales_invoice_item_stock_allocations_supplier"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_sales_invoice_item_stock_allocations_item"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_sales_invoice_item_stock_allocations_invoice"`,
    );
    await queryRunner.query(`DROP TABLE "sales_invoice_item_stock_allocations"`);
  }
}
