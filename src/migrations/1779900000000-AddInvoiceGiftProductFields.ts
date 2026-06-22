import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceGiftProductFields1779900000000
  implements MigrationInterface
{
  name = 'AddInvoiceGiftProductFields1779900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_invoices"
      ADD "gift_product_id" integer,
      ADD "gift_product_name" character varying(255),
      ADD "gift_quantity" numeric(15,4),
      ADD "gift_unit_price" numeric(15,2),
      ADD "gift_inventory_transaction_id" integer
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_sales_invoices_gift_product" ON "sales_invoices" ("gift_product_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_gift_product" FOREIGN KEY ("gift_product_id") REFERENCES "products"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_gift_inventory_transaction" FOREIGN KEY ("gift_inventory_transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_gift_inventory_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_gift_product"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_sales_invoices_gift_product"`);
    await queryRunner.query(`
      ALTER TABLE "sales_invoices"
      DROP COLUMN "gift_inventory_transaction_id",
      DROP COLUMN "gift_unit_price",
      DROP COLUMN "gift_quantity",
      DROP COLUMN "gift_product_name",
      DROP COLUMN "gift_product_id"
    `);
  }
}
