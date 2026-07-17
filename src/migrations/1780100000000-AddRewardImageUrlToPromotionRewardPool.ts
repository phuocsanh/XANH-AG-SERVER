import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRewardImageUrlToPromotionRewardPool1780100000000
  implements MigrationInterface
{
  name = 'AddRewardImageUrlToPromotionRewardPool1780100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_pool"
      ADD COLUMN IF NOT EXISTS "reward_image_url" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_pool"
      DROP COLUMN IF EXISTS "reward_image_url"
    `);
  }
}
