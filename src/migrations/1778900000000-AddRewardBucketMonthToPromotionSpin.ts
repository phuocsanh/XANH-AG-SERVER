import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRewardBucketMonthToPromotionSpin1778900000000
  implements MigrationInterface
{
  name = 'AddRewardBucketMonthToPromotionSpin1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_overrides"
      ADD COLUMN IF NOT EXISTS "assigned_reward_bucket_month" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "promotion_reward_reservations"
      ADD COLUMN IF NOT EXISTS "reward_bucket_month" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_promotion_spin_logs"
      ADD COLUMN IF NOT EXISTS "reward_bucket_month" integer
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promotion_reward_reservations_bucket"
      ON "promotion_reward_reservations" (
        "promotion_id",
        "reward_pool_id",
        "reward_bucket_month",
        "status"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_promotion_overrides_bucket"
      ON "customer_promotion_overrides" (
        "promotion_id",
        "assigned_reward_pool_id",
        "assigned_reward_bucket_month",
        "force_win_remaining_count"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_customer_promotion_overrides_bucket"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promotion_reward_reservations_bucket"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_spin_logs"
      DROP COLUMN IF EXISTS "reward_bucket_month"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_reservations"
      DROP COLUMN IF EXISTS "reward_bucket_month"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_overrides"
      DROP COLUMN IF EXISTS "assigned_reward_bucket_month"
    `);
  }
}
