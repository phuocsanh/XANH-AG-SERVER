import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCostingMethodAndSalesItemCostSnapshot1779000000000 implements MigrationInterface {
    name = 'AddCostingMethodAndSalesItemCostSnapshot1779000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "costing_method" character varying(50) NOT NULL DEFAULT 'fixed'`);
        await queryRunner.query(`ALTER TABLE "products" ADD "cash_cost_price" character varying`);
        await queryRunner.query(`ALTER TABLE "products" ADD "credit_cost_price" character varying`);

        await queryRunner.query(`ALTER TABLE "sales_invoice_items" ADD "price_type" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "sales_invoice_items" ADD "cost_price" numeric(15,2)`);
        await queryRunner.query(`ALTER TABLE "sales_invoice_items" ADD "costing_method_snapshot" character varying(50)`);

        await queryRunner.query(`ALTER TABLE "sales_return_items" ADD "sales_invoice_item_id" integer`);
        await queryRunner.query(`ALTER TABLE "sales_return_items" ADD CONSTRAINT "FK_sales_return_items_sales_invoice_item" FOREIGN KEY ("sales_invoice_item_id") REFERENCES "sales_invoice_items"("id") ON DELETE SET NULL`);

        await queryRunner.query(`
            UPDATE "sales_invoice_items" sii
            SET
                "cost_price" = COALESCE(NULLIF(regexp_replace(COALESCE(p."average_cost_price", ''), '[^0-9.-]', '', 'g'), '')::numeric, 0),
                "costing_method_snapshot" = 'fixed'
            FROM "products" p
            WHERE sii."product_id" = p."id"
              AND sii."cost_price" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales_return_items" DROP CONSTRAINT "FK_sales_return_items_sales_invoice_item"`);
        await queryRunner.query(`ALTER TABLE "sales_return_items" DROP COLUMN "sales_invoice_item_id"`);

        await queryRunner.query(`ALTER TABLE "sales_invoice_items" DROP COLUMN "costing_method_snapshot"`);
        await queryRunner.query(`ALTER TABLE "sales_invoice_items" DROP COLUMN "cost_price"`);
        await queryRunner.query(`ALTER TABLE "sales_invoice_items" DROP COLUMN "price_type"`);

        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "credit_cost_price"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "cash_cost_price"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "costing_method"`);
    }
}
