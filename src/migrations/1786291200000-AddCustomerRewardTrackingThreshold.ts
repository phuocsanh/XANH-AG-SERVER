import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerRewardTrackingThreshold1786291200000
  implements MigrationInterface
{
  name = 'AddCustomerRewardTrackingThreshold1786291200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_reward_tracking"
      ADD COLUMN IF NOT EXISTS "reward_threshold" numeric(15,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_reward_tracking"
      DROP COLUMN IF EXISTS "reward_threshold"
    `);
  }
}
