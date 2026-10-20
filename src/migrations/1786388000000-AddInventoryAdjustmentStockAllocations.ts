import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryAdjustmentStockAllocations1786388000000
  implements MigrationInterface
{
  name = 'AddInventoryAdjustmentStockAllocations1786388000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_adjustment_items"
      ADD COLUMN IF NOT EXISTS "stock_allocations" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_adjustment_items"
      DROP COLUMN IF EXISTS "stock_allocations"
    `);
  }
}
