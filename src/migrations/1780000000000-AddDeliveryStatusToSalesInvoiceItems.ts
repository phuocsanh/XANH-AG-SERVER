import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryStatusToSalesInvoiceItems1780000000000
  implements MigrationInterface
{
  name = 'AddDeliveryStatusToSalesInvoiceItems1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_invoice_items"
      ADD "is_delivered" boolean NOT NULL DEFAULT false,
      ADD "delivered_at" TIMESTAMP,
      ADD "delivered_by" integer
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_sales_invoice_items_delivery_status" ON "sales_invoice_items" ("is_delivered", "invoice_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "FK_sales_invoice_items_delivered_by" FOREIGN KEY ("delivered_by") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_items" DROP CONSTRAINT "FK_sales_invoice_items_delivered_by"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_sales_invoice_items_delivery_status"`,
    );
    await queryRunner.query(`
      ALTER TABLE "sales_invoice_items"
      DROP COLUMN "delivered_by",
      DROP COLUMN "delivered_at",
      DROP COLUMN "is_delivered"
    `);
  }
}
