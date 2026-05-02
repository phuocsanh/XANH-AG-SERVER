import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerPromotionOverrides1778800000000
  implements MigrationInterface
{
  name = 'CreateCustomerPromotionOverrides1778800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_promotion_overrides" (
        "id" SERIAL NOT NULL,
        "promotion_id" integer NOT NULL,
        "customer_id" integer NOT NULL,
        "force_win_remaining_count" integer NOT NULL DEFAULT '0',
        "assigned_reward_pool_id" integer,
        "assigned_reward_name" character varying,
        "assigned_reward_value" numeric(15,2) NOT NULL DEFAULT '0',
        "win_rate_multiplier" numeric(8,4) NOT NULL DEFAULT '1',
        "note" text,
        "set_by" integer,
        "set_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_promotion_overrides_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customer_promotion_overrides_promotion_customer" UNIQUE ("promotion_id", "customer_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_customer_promotion_overrides_campaign'
        ) THEN
          ALTER TABLE "customer_promotion_overrides"
          ADD CONSTRAINT "FK_customer_promotion_overrides_campaign"
          FOREIGN KEY ("promotion_id") REFERENCES "promotion_campaigns"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_customer_promotion_overrides_customer'
        ) THEN
          ALTER TABLE "customer_promotion_overrides"
          ADD CONSTRAINT "FK_customer_promotion_overrides_customer"
          FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_customer_promotion_overrides_reward_pool'
        ) THEN
          ALTER TABLE "customer_promotion_overrides"
          ADD CONSTRAINT "FK_customer_promotion_overrides_reward_pool"
          FOREIGN KEY ("assigned_reward_pool_id") REFERENCES "promotion_reward_pool"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_customer_promotion_overrides_set_by'
        ) THEN
          ALTER TABLE "customer_promotion_overrides"
          ADD CONSTRAINT "FK_customer_promotion_overrides_set_by"
          FOREIGN KEY ("set_by") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_overrides"
      DROP CONSTRAINT IF EXISTS "FK_customer_promotion_overrides_set_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_overrides"
      DROP CONSTRAINT IF EXISTS "FK_customer_promotion_overrides_reward_pool"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_overrides"
      DROP CONSTRAINT IF EXISTS "FK_customer_promotion_overrides_customer"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_overrides"
      DROP CONSTRAINT IF EXISTS "FK_customer_promotion_overrides_campaign"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_promotion_overrides"`);
  }
}
