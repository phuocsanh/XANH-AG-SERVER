import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaxableQuantityToSalesStockAllocations1786380000000
  implements MigrationInterface
{
  name = 'AddTaxableQuantityToSalesStockAllocations1786380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_invoice_item_stock_allocations"
      ADD COLUMN IF NOT EXISTS "taxable_quantity" numeric(15,4)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_invoice_item_stock_allocations"
      DROP COLUMN IF EXISTS "taxable_quantity"
    `);
  }
}
