import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceGiftStockAllocations1786391000000
  implements MigrationInterface
{
  name = 'AddInvoiceGiftStockAllocations1786391000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_invoices"
      ADD COLUMN IF NOT EXISTS "gift_stock_allocations" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_invoices"
      DROP COLUMN IF EXISTS "gift_stock_allocations"
    `);
  }
}
