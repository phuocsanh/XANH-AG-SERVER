import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerRewardStockAllocations1786389000000
  implements MigrationInterface
{
  name = 'AddCustomerRewardStockAllocations1786389000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_reward_history"
      ADD COLUMN IF NOT EXISTS "stock_allocations" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_reward_history"
      DROP COLUMN IF EXISTS "stock_allocations"
    `);
  }
}
