import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReceiptSupplierSettlementMode1779500000000
  implements MigrationInterface
{
  name = 'AddReceiptSupplierSettlementMode1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_receipts"
      ADD "supplier_settlement_mode" character varying(30) NOT NULL DEFAULT 'standard'
    `);

    await queryRunner.query(`
      CREATE TABLE "inventory_receipt_supplier_settlements" (
        "id" SERIAL NOT NULL,
        "receipt_id" integer NOT NULL,
        "receipt_item_id" integer,
        "supplier_id" integer,
        "product_id" integer NOT NULL,
        "invoice_id" integer,
        "sales_invoice_item_id" integer,
        "sales_return_id" integer,
        "entry_type" character varying(20) NOT NULL,
        "price_type" character varying(20),
        "quantity" numeric(15,4) NOT NULL,
        "unit_cost" numeric(15,2) NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_receipt_supplier_settlements" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_receipt_supplier_settlements_receipt" ON "inventory_receipt_supplier_settlements" ("receipt_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_receipt_supplier_settlements_invoice" ON "inventory_receipt_supplier_settlements" ("invoice_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_receipt_supplier_settlements_return" ON "inventory_receipt_supplier_settlements" ("sales_return_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" ADD CONSTRAINT "FK_receipt_supplier_settlements_receipt" FOREIGN KEY ("receipt_id") REFERENCES "inventory_receipts"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" ADD CONSTRAINT "FK_receipt_supplier_settlements_receipt_item" FOREIGN KEY ("receipt_item_id") REFERENCES "inventory_receipt_items"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" ADD CONSTRAINT "FK_receipt_supplier_settlements_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" ADD CONSTRAINT "FK_receipt_supplier_settlements_product" FOREIGN KEY ("product_id") REFERENCES "products"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" ADD CONSTRAINT "FK_receipt_supplier_settlements_invoice" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" ADD CONSTRAINT "FK_receipt_supplier_settlements_invoice_item" FOREIGN KEY ("sales_invoice_item_id") REFERENCES "sales_invoice_items"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" ADD CONSTRAINT "FK_receipt_supplier_settlements_sales_return" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" DROP CONSTRAINT "FK_receipt_supplier_settlements_sales_return"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" DROP CONSTRAINT "FK_receipt_supplier_settlements_invoice_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" DROP CONSTRAINT "FK_receipt_supplier_settlements_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" DROP CONSTRAINT "FK_receipt_supplier_settlements_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" DROP CONSTRAINT "FK_receipt_supplier_settlements_supplier"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" DROP CONSTRAINT "FK_receipt_supplier_settlements_receipt_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_supplier_settlements" DROP CONSTRAINT "FK_receipt_supplier_settlements_receipt"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_receipt_supplier_settlements_return"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_receipt_supplier_settlements_invoice"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_receipt_supplier_settlements_receipt"`,
    );
    await queryRunner.query(`DROP TABLE "inventory_receipt_supplier_settlements"`);
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" DROP COLUMN "supplier_settlement_mode"`,
    );
  }
}
