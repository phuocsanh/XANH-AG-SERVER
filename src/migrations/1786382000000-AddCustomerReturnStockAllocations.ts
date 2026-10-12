import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerReturnStockAllocations1786382000000
  implements MigrationInterface
{
  name = 'AddCustomerReturnStockAllocations1786382000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_return_items"
      ADD COLUMN IF NOT EXISTS "stock_allocations" json
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_return_items"
      DROP COLUMN IF EXISTS "stock_allocations"
    `);
  }
}
