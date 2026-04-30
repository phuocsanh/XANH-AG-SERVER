import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpgradePromotionCampaignToSpinModel1778700000000
  implements MigrationInterface
{
  name = 'UpgradePromotionCampaignToSpinModel1778700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ADD COLUMN IF NOT EXISTS "base_win_rate" numeric(5,2) NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ADD COLUMN IF NOT EXISTS "second_win_rate" numeric(5,2) NOT NULL DEFAULT '2'
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ADD COLUMN IF NOT EXISTS "reward_release_mode" character varying NOT NULL DEFAULT 'monthly'
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ALTER COLUMN "reward_type" SET DEFAULT 'spin_reward'
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ALTER COLUMN "reward_name" SET DEFAULT 'Spin rewards'
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ALTER COLUMN "reward_quota" SET DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ALTER COLUMN "reward_value" SET DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ALTER COLUMN "max_reward_per_customer" SET DEFAULT '2'
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      ADD COLUMN IF NOT EXISTS "earned_spin_count" integer NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      ADD COLUMN IF NOT EXISTS "used_spin_count" integer NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      ADD COLUMN IF NOT EXISTS "remaining_spin_count" integer NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      ADD COLUMN IF NOT EXISTS "win_count" integer NOT NULL DEFAULT '0'
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      ADD COLUMN IF NOT EXISTS "last_spin_at" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      ADD COLUMN IF NOT EXISTS "last_win_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promotion_reward_pool" (
        "id" SERIAL NOT NULL,
        "promotion_id" integer NOT NULL,
        "reward_code" character varying,
        "reward_name" character varying NOT NULL,
        "reward_value" numeric(15,2) NOT NULL,
        "total_quantity" integer NOT NULL DEFAULT '0',
        "remaining_quantity" integer NOT NULL DEFAULT '0',
        "reserved_quantity" integer NOT NULL DEFAULT '0',
        "issued_quantity" integer NOT NULL DEFAULT '0',
        "sort_order" integer NOT NULL DEFAULT '0',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promotion_reward_pool_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promotion_reward_release_schedule" (
        "id" SERIAL NOT NULL,
        "promotion_id" integer NOT NULL,
        "reward_pool_id" integer NOT NULL,
        "bucket_month" integer NOT NULL,
        "release_quantity" integer NOT NULL DEFAULT '0',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promotion_reward_release_schedule_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_promotion_spin_logs" (
        "id" SERIAL NOT NULL,
        "promotion_id" integer NOT NULL,
        "customer_id" integer NOT NULL,
        "spin_no" integer NOT NULL DEFAULT '1',
        "result_type" character varying NOT NULL,
        "reward_pool_id" integer,
        "reward_name" character varying,
        "reward_value" numeric(15,2) NOT NULL DEFAULT '0',
        "win_probability_applied" numeric(5,2) NOT NULL DEFAULT '0',
        "customer_win_count_before_spin" integer NOT NULL DEFAULT '0',
        "spun_at" TIMESTAMPTZ NOT NULL,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_promotion_spin_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promotion_reward_reservations" (
        "id" SERIAL NOT NULL,
        "promotion_id" integer NOT NULL,
        "customer_id" integer NOT NULL,
        "spin_log_id" integer NOT NULL,
        "reward_pool_id" integer NOT NULL,
        "reward_name" character varying NOT NULL,
        "reward_value" numeric(15,2) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'reserved',
        "reserved_at" TIMESTAMPTZ NOT NULL,
        "issued_at" TIMESTAMPTZ,
        "issued_by" integer,
        "expense_posted_at" TIMESTAMPTZ,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promotion_reward_reservations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_reward_release_schedule_unique_bucket"
      ON "promotion_reward_release_schedule" ("promotion_id", "reward_pool_id", "bucket_month")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_promotion_spin_logs_campaign_customer"
      ON "customer_promotion_spin_logs" ("promotion_id", "customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promotion_reward_reservations_campaign_status"
      ON "promotion_reward_reservations" ("promotion_id", "status")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_promotion_reward_pool_campaign'
        ) THEN
          ALTER TABLE "promotion_reward_pool"
          ADD CONSTRAINT "FK_promotion_reward_pool_campaign"
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
          WHERE conname = 'FK_promotion_reward_release_schedule_campaign'
        ) THEN
          ALTER TABLE "promotion_reward_release_schedule"
          ADD CONSTRAINT "FK_promotion_reward_release_schedule_campaign"
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
          WHERE conname = 'FK_promotion_reward_release_schedule_pool'
        ) THEN
          ALTER TABLE "promotion_reward_release_schedule"
          ADD CONSTRAINT "FK_promotion_reward_release_schedule_pool"
          FOREIGN KEY ("reward_pool_id") REFERENCES "promotion_reward_pool"("id")
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
          WHERE conname = 'FK_customer_promotion_spin_logs_campaign'
        ) THEN
          ALTER TABLE "customer_promotion_spin_logs"
          ADD CONSTRAINT "FK_customer_promotion_spin_logs_campaign"
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
          WHERE conname = 'FK_customer_promotion_spin_logs_customer'
        ) THEN
          ALTER TABLE "customer_promotion_spin_logs"
          ADD CONSTRAINT "FK_customer_promotion_spin_logs_customer"
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
          WHERE conname = 'FK_customer_promotion_spin_logs_reward_pool'
        ) THEN
          ALTER TABLE "customer_promotion_spin_logs"
          ADD CONSTRAINT "FK_customer_promotion_spin_logs_reward_pool"
          FOREIGN KEY ("reward_pool_id") REFERENCES "promotion_reward_pool"("id")
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
          WHERE conname = 'FK_promotion_reward_reservations_campaign'
        ) THEN
          ALTER TABLE "promotion_reward_reservations"
          ADD CONSTRAINT "FK_promotion_reward_reservations_campaign"
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
          WHERE conname = 'FK_promotion_reward_reservations_customer'
        ) THEN
          ALTER TABLE "promotion_reward_reservations"
          ADD CONSTRAINT "FK_promotion_reward_reservations_customer"
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
          WHERE conname = 'FK_promotion_reward_reservations_spin_log'
        ) THEN
          ALTER TABLE "promotion_reward_reservations"
          ADD CONSTRAINT "FK_promotion_reward_reservations_spin_log"
          FOREIGN KEY ("spin_log_id") REFERENCES "customer_promotion_spin_logs"("id")
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
          WHERE conname = 'FK_promotion_reward_reservations_reward_pool'
        ) THEN
          ALTER TABLE "promotion_reward_reservations"
          ADD CONSTRAINT "FK_promotion_reward_reservations_reward_pool"
          FOREIGN KEY ("reward_pool_id") REFERENCES "promotion_reward_pool"("id")
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
          WHERE conname = 'FK_promotion_reward_reservations_issued_by'
        ) THEN
          ALTER TABLE "promotion_reward_reservations"
          ADD CONSTRAINT "FK_promotion_reward_reservations_issued_by"
          FOREIGN KEY ("issued_by") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_reservations"
      DROP CONSTRAINT IF EXISTS "FK_promotion_reward_reservations_issued_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_reservations"
      DROP CONSTRAINT IF EXISTS "FK_promotion_reward_reservations_reward_pool"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_reservations"
      DROP CONSTRAINT IF EXISTS "FK_promotion_reward_reservations_spin_log"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_reservations"
      DROP CONSTRAINT IF EXISTS "FK_promotion_reward_reservations_customer"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_reservations"
      DROP CONSTRAINT IF EXISTS "FK_promotion_reward_reservations_campaign"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_spin_logs"
      DROP CONSTRAINT IF EXISTS "FK_customer_promotion_spin_logs_reward_pool"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_spin_logs"
      DROP CONSTRAINT IF EXISTS "FK_customer_promotion_spin_logs_customer"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_spin_logs"
      DROP CONSTRAINT IF EXISTS "FK_customer_promotion_spin_logs_campaign"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_release_schedule"
      DROP CONSTRAINT IF EXISTS "FK_promotion_reward_release_schedule_pool"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_release_schedule"
      DROP CONSTRAINT IF EXISTS "FK_promotion_reward_release_schedule_campaign"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_pool"
      DROP CONSTRAINT IF EXISTS "FK_promotion_reward_pool_campaign"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promotion_reward_release_schedule_unique_bucket"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_customer_promotion_spin_logs_campaign_customer"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_promotion_reward_reservations_campaign_status"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "promotion_reward_reservations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_promotion_spin_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promotion_reward_release_schedule"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promotion_reward_pool"`);

    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      DROP COLUMN IF EXISTS "last_win_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      DROP COLUMN IF EXISTS "last_spin_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      DROP COLUMN IF EXISTS "win_count"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      DROP COLUMN IF EXISTS "remaining_spin_count"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      DROP COLUMN IF EXISTS "used_spin_count"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      DROP COLUMN IF EXISTS "earned_spin_count"
    `);

    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      DROP COLUMN IF EXISTS "reward_release_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      DROP COLUMN IF EXISTS "second_win_rate"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      DROP COLUMN IF EXISTS "base_win_rate"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ALTER COLUMN "reward_type" SET DEFAULT 'manual_gift'
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ALTER COLUMN "max_reward_per_customer" SET DEFAULT '1'
    `);
  }
}
