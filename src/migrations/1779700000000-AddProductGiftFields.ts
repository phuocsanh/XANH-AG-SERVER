import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductGiftFields1779700000000 implements MigrationInterface {
  name = 'AddProductGiftFields1779700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_reward_history"
      ADD "gift_product_id" integer,
      ADD "gift_product_name" character varying(255),
      ADD "gift_quantity" numeric(15,4),
      ADD "gift_unit_price" numeric(15,2),
      ADD "gift_inventory_transaction_id" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "farm_gift_costs"
      ADD "product_id" integer,
      ADD "product_name" character varying(255),
      ADD "quantity" numeric(15,4),
      ADD "unit_price" numeric(15,2),
      ADD "inventory_transaction_id" integer
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_reward_history_gift_product" ON "customer_reward_history" ("gift_product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_farm_gift_costs_product" ON "farm_gift_costs" ("product_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "customer_reward_history" ADD CONSTRAINT "FK_customer_reward_history_gift_product" FOREIGN KEY ("gift_product_id") REFERENCES "products"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_reward_history" ADD CONSTRAINT "FK_customer_reward_history_gift_inventory_transaction" FOREIGN KEY ("gift_inventory_transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "farm_gift_costs" ADD CONSTRAINT "FK_farm_gift_costs_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "farm_gift_costs" ADD CONSTRAINT "FK_farm_gift_costs_inventory_transaction" FOREIGN KEY ("inventory_transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "farm_gift_costs" DROP CONSTRAINT "FK_farm_gift_costs_inventory_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "farm_gift_costs" DROP CONSTRAINT "FK_farm_gift_costs_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_reward_history" DROP CONSTRAINT "FK_customer_reward_history_gift_inventory_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_reward_history" DROP CONSTRAINT "FK_customer_reward_history_gift_product"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_farm_gift_costs_product"`);
    await queryRunner.query(`DROP INDEX "IDX_customer_reward_history_gift_product"`);

    await queryRunner.query(`
      ALTER TABLE "farm_gift_costs"
      DROP COLUMN "inventory_transaction_id",
      DROP COLUMN "unit_price",
      DROP COLUMN "quantity",
      DROP COLUMN "product_name",
      DROP COLUMN "product_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_reward_history"
      DROP COLUMN "gift_inventory_transaction_id",
      DROP COLUMN "gift_unit_price",
      DROP COLUMN "gift_quantity",
      DROP COLUMN "gift_product_name",
      DROP COLUMN "gift_product_id"
    `);
  }
}
