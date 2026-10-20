import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotionRewardInventorySnapshots1786390000000
  implements MigrationInterface
{
  name = 'AddPromotionRewardInventorySnapshots1786390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_pool"
      ADD COLUMN IF NOT EXISTS "reward_product_id" integer,
      ADD COLUMN IF NOT EXISTS "reward_product_quantity" numeric(15, 4) NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_reservations"
      ADD COLUMN IF NOT EXISTS "reward_product_id" integer,
      ADD COLUMN IF NOT EXISTS "reward_product_quantity" numeric(15, 4),
      ADD COLUMN IF NOT EXISTS "stock_allocations" jsonb,
      ADD COLUMN IF NOT EXISTS "gift_inventory_transaction_id" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_overrides"
      ADD COLUMN IF NOT EXISTS "assigned_reward_product_id" integer,
      ADD COLUMN IF NOT EXISTS "assigned_reward_product_quantity" numeric(15, 4)
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "promotion_reward_pool"
        ADD CONSTRAINT "FK_promotion_reward_pool_product"
        FOREIGN KEY ("reward_product_id") REFERENCES "products"("id") ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "promotion_reward_reservations"
        ADD CONSTRAINT "FK_promotion_reward_reservations_product"
        FOREIGN KEY ("reward_product_id") REFERENCES "products"("id") ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "customer_promotion_overrides"
        ADD CONSTRAINT "FK_customer_promotion_overrides_reward_product"
        FOREIGN KEY ("assigned_reward_product_id") REFERENCES "products"("id") ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_reservations"
      DROP CONSTRAINT IF EXISTS "FK_promotion_reward_reservations_product",
      DROP COLUMN IF EXISTS "gift_inventory_transaction_id",
      DROP COLUMN IF EXISTS "stock_allocations",
      DROP COLUMN IF EXISTS "reward_product_quantity",
      DROP COLUMN IF EXISTS "reward_product_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_overrides"
      DROP CONSTRAINT IF EXISTS "FK_customer_promotion_overrides_reward_product",
      DROP COLUMN IF EXISTS "assigned_reward_product_quantity",
      DROP COLUMN IF EXISTS "assigned_reward_product_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_pool"
      DROP CONSTRAINT IF EXISTS "FK_promotion_reward_pool_product",
      DROP COLUMN IF EXISTS "reward_product_quantity",
      DROP COLUMN IF EXISTS "reward_product_id"
    `);
  }
}
