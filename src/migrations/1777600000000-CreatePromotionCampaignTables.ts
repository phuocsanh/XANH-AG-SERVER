import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromotionCampaignTables1777600000000
  implements MigrationInterface
{
  name = 'CreatePromotionCampaignTables1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."promotion_campaigns_status_enum"
      AS ENUM ('draft', 'active', 'ended', 'archived')
    `);

    await queryRunner.query(`
      CREATE TABLE "promotion_campaigns" (
        "id" SERIAL NOT NULL,
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "type" character varying NOT NULL DEFAULT 'accumulated_purchase_gift',
        "status" "public"."promotion_campaigns_status_enum" NOT NULL DEFAULT 'draft',
        "start_at" TIMESTAMPTZ NOT NULL,
        "end_at" TIMESTAMPTZ NOT NULL,
        "threshold_amount" numeric(15,2) NOT NULL,
        "reward_quota" integer NOT NULL,
        "reward_type" character varying NOT NULL DEFAULT 'manual_gift',
        "reward_name" character varying NOT NULL,
        "reward_value" numeric(15,2) NOT NULL,
        "max_reward_per_customer" integer NOT NULL DEFAULT '1',
        "notes" text,
        "created_by" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_promotion_campaigns_code" UNIQUE ("code"),
        CONSTRAINT "PK_promotion_campaigns_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "promotion_campaign_products" (
        "id" SERIAL NOT NULL,
        "promotion_id" integer NOT NULL,
        "product_id" integer NOT NULL,
        "product_name_snapshot" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promotion_campaign_products_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "customer_promotion_progress" (
        "id" SERIAL NOT NULL,
        "promotion_id" integer NOT NULL,
        "customer_id" integer NOT NULL,
        "qualified_amount" numeric(15,2) NOT NULL DEFAULT '0',
        "qualified_order_count" integer NOT NULL DEFAULT '0',
        "is_eligible" boolean NOT NULL DEFAULT false,
        "eligible_at" TIMESTAMPTZ,
        "is_selected_for_reward" boolean NOT NULL DEFAULT false,
        "selected_at" TIMESTAMPTZ,
        "selected_by" integer,
        "is_reward_issued" boolean NOT NULL DEFAULT false,
        "reward_issued_at" TIMESTAMPTZ,
        "reward_issued_by" integer,
        "promotion_expense_amount" numeric(15,2) NOT NULL DEFAULT '0',
        "last_calculated_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_customer_promotion_progress_promotion_customer"
          UNIQUE ("promotion_id", "customer_id"),
        CONSTRAINT "PK_customer_promotion_progress_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "customer_promotion_ledger" (
        "id" SERIAL NOT NULL,
        "promotion_id" integer NOT NULL,
        "customer_id" integer NOT NULL,
        "order_id" integer NOT NULL,
        "order_code" character varying,
        "order_item_id" integer,
        "product_id" integer,
        "change_type" character varying NOT NULL,
        "amount_delta" numeric(15,2) NOT NULL DEFAULT '0',
        "quantity_delta" numeric(15,4) NOT NULL DEFAULT '0',
        "source_status" character varying,
        "reference_type" character varying,
        "reference_id" integer,
        "event_at" TIMESTAMPTZ NOT NULL,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_promotion_ledger_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "promotion_reward_selections" (
        "id" SERIAL NOT NULL,
        "promotion_id" integer NOT NULL,
        "customer_id" integer NOT NULL,
        "progress_id" integer,
        "reward_name" character varying NOT NULL,
        "reward_value" numeric(15,2) NOT NULL,
        "selected_by" integer,
        "selected_at" TIMESTAMPTZ,
        "issue_status" character varying NOT NULL DEFAULT 'selected',
        "issued_at" TIMESTAMPTZ,
        "issued_by" integer,
        "promotion_expense_status" character varying NOT NULL DEFAULT 'pending',
        "promotion_expense_posted_at" TIMESTAMPTZ,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promotion_reward_selections_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "promotion_campaigns"
      ADD CONSTRAINT "FK_promotion_campaigns_created_by_users"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaign_products"
      ADD CONSTRAINT "FK_promotion_campaign_products_campaign"
      FOREIGN KEY ("promotion_id") REFERENCES "promotion_campaigns"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_campaign_products"
      ADD CONSTRAINT "FK_promotion_campaign_products_product"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      ADD CONSTRAINT "FK_customer_promotion_progress_campaign"
      FOREIGN KEY ("promotion_id") REFERENCES "promotion_campaigns"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      ADD CONSTRAINT "FK_customer_promotion_progress_customer"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      ADD CONSTRAINT "FK_customer_promotion_progress_selected_by"
      FOREIGN KEY ("selected_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_progress"
      ADD CONSTRAINT "FK_customer_promotion_progress_issued_by"
      FOREIGN KEY ("reward_issued_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_ledger"
      ADD CONSTRAINT "FK_customer_promotion_ledger_campaign"
      FOREIGN KEY ("promotion_id") REFERENCES "promotion_campaigns"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_ledger"
      ADD CONSTRAINT "FK_customer_promotion_ledger_customer"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_ledger"
      ADD CONSTRAINT "FK_customer_promotion_ledger_order"
      FOREIGN KEY ("order_id") REFERENCES "sales_invoices"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_ledger"
      ADD CONSTRAINT "FK_customer_promotion_ledger_order_item"
      FOREIGN KEY ("order_item_id") REFERENCES "sales_invoice_items"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_promotion_ledger"
      ADD CONSTRAINT "FK_customer_promotion_ledger_product"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_selections"
      ADD CONSTRAINT "FK_promotion_reward_selections_campaign"
      FOREIGN KEY ("promotion_id") REFERENCES "promotion_campaigns"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_selections"
      ADD CONSTRAINT "FK_promotion_reward_selections_customer"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_selections"
      ADD CONSTRAINT "FK_promotion_reward_selections_progress"
      FOREIGN KEY ("progress_id") REFERENCES "customer_promotion_progress"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_selections"
      ADD CONSTRAINT "FK_promotion_reward_selections_selected_by"
      FOREIGN KEY ("selected_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "promotion_reward_selections"
      ADD CONSTRAINT "FK_promotion_reward_selections_issued_by"
      FOREIGN KEY ("issued_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "promotion_reward_selections" DROP CONSTRAINT "FK_promotion_reward_selections_issued_by"`);
    await queryRunner.query(`ALTER TABLE "promotion_reward_selections" DROP CONSTRAINT "FK_promotion_reward_selections_selected_by"`);
    await queryRunner.query(`ALTER TABLE "promotion_reward_selections" DROP CONSTRAINT "FK_promotion_reward_selections_progress"`);
    await queryRunner.query(`ALTER TABLE "promotion_reward_selections" DROP CONSTRAINT "FK_promotion_reward_selections_customer"`);
    await queryRunner.query(`ALTER TABLE "promotion_reward_selections" DROP CONSTRAINT "FK_promotion_reward_selections_campaign"`);
    await queryRunner.query(`ALTER TABLE "customer_promotion_ledger" DROP CONSTRAINT "FK_customer_promotion_ledger_product"`);
    await queryRunner.query(`ALTER TABLE "customer_promotion_ledger" DROP CONSTRAINT "FK_customer_promotion_ledger_order_item"`);
    await queryRunner.query(`ALTER TABLE "customer_promotion_ledger" DROP CONSTRAINT "FK_customer_promotion_ledger_order"`);
    await queryRunner.query(`ALTER TABLE "customer_promotion_ledger" DROP CONSTRAINT "FK_customer_promotion_ledger_customer"`);
    await queryRunner.query(`ALTER TABLE "customer_promotion_ledger" DROP CONSTRAINT "FK_customer_promotion_ledger_campaign"`);
    await queryRunner.query(`ALTER TABLE "customer_promotion_progress" DROP CONSTRAINT "FK_customer_promotion_progress_issued_by"`);
    await queryRunner.query(`ALTER TABLE "customer_promotion_progress" DROP CONSTRAINT "FK_customer_promotion_progress_selected_by"`);
    await queryRunner.query(`ALTER TABLE "customer_promotion_progress" DROP CONSTRAINT "FK_customer_promotion_progress_customer"`);
    await queryRunner.query(`ALTER TABLE "customer_promotion_progress" DROP CONSTRAINT "FK_customer_promotion_progress_campaign"`);
    await queryRunner.query(`ALTER TABLE "promotion_campaign_products" DROP CONSTRAINT "FK_promotion_campaign_products_product"`);
    await queryRunner.query(`ALTER TABLE "promotion_campaign_products" DROP CONSTRAINT "FK_promotion_campaign_products_campaign"`);
    await queryRunner.query(`ALTER TABLE "promotion_campaigns" DROP CONSTRAINT "FK_promotion_campaigns_created_by_users"`);

    await queryRunner.query(`DROP TABLE "promotion_reward_selections"`);
    await queryRunner.query(`DROP TABLE "customer_promotion_ledger"`);
    await queryRunner.query(`DROP TABLE "customer_promotion_progress"`);
    await queryRunner.query(`DROP TABLE "promotion_campaign_products"`);
    await queryRunner.query(`DROP TABLE "promotion_campaigns"`);
    await queryRunner.query(`DROP TYPE "public"."promotion_campaigns_status_enum"`);
  }
}
