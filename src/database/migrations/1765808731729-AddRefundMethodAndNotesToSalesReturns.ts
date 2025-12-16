import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefundMethodAndNotesToSalesReturns1765808731729 implements MigrationInterface {
    name = 'AddRefundMethodAndNotesToSalesReturns1765808731729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rice_crops" DROP CONSTRAINT "FK_62502b294056dcbd3c74fb50590"`);
        await queryRunner.query(`ALTER TABLE "operating_costs" DROP CONSTRAINT "FK_0d957586da52c9056e580ce1017"`);
        await queryRunner.query(`ALTER TABLE "operating_costs" DROP CONSTRAINT "FK_3b90deead5283bc358a91a8e19f"`);
        await queryRunner.query(`ALTER TABLE "operating_costs" DROP CONSTRAINT "FK_6f6e15860edf01302e013c71a10"`);
        await queryRunner.query(`ALTER TABLE "cost_items" DROP CONSTRAINT "FK_a3c7c68028cd696587922b89d02"`);
        await queryRunner.query(`ALTER TABLE "sales_returns" ADD "refund_method" character varying(20) NOT NULL DEFAULT 'debt_credit'`);
        await queryRunner.query(`ALTER TABLE "sales_returns" ADD "notes" text`);
        await queryRunner.query(`ALTER TABLE "sales_invoices" ALTER COLUMN "gift_value" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "debt_notes" ALTER COLUMN "gift_value" SET NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "payments"."debt_note_code" IS NULL`);
        await queryRunner.query(`ALTER TABLE "operating_costs" ALTER COLUMN "expense_date" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "inventory_returns" ADD CONSTRAINT "UQ_a66152495cfbba7ecade455be94" UNIQUE ("code")`);
        await queryRunner.query(`ALTER TABLE "rice_crops" ADD CONSTRAINT "FK_62502b294056dcbd3c74fb50590" FOREIGN KEY ("area_of_each_plot_of_land_id") REFERENCES "area_of_each_plot_of_land"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "operating_costs" ADD CONSTRAINT "FK_6f6e15860edf01302e013c71a10" FOREIGN KEY ("category_id") REFERENCES "operating_cost_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "operating_costs" ADD CONSTRAINT "FK_3b90deead5283bc358a91a8e19f" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "operating_costs" ADD CONSTRAINT "FK_0d957586da52c9056e580ce1017" FOREIGN KEY ("rice_crop_id") REFERENCES "rice_crops"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cost_items" ADD CONSTRAINT "FK_a3c7c68028cd696587922b89d02" FOREIGN KEY ("category_id") REFERENCES "cost_item_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cost_items" DROP CONSTRAINT "FK_a3c7c68028cd696587922b89d02"`);
        await queryRunner.query(`ALTER TABLE "operating_costs" DROP CONSTRAINT "FK_0d957586da52c9056e580ce1017"`);
        await queryRunner.query(`ALTER TABLE "operating_costs" DROP CONSTRAINT "FK_3b90deead5283bc358a91a8e19f"`);
        await queryRunner.query(`ALTER TABLE "operating_costs" DROP CONSTRAINT "FK_6f6e15860edf01302e013c71a10"`);
        await queryRunner.query(`ALTER TABLE "rice_crops" DROP CONSTRAINT "FK_62502b294056dcbd3c74fb50590"`);
        await queryRunner.query(`ALTER TABLE "inventory_returns" DROP CONSTRAINT "UQ_a66152495cfbba7ecade455be94"`);
        await queryRunner.query(`ALTER TABLE "operating_costs" ALTER COLUMN "expense_date" DROP NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "payments"."debt_note_code" IS 'Mã phiếu công nợ liên quan (để hiển thị trên UI)'`);
        await queryRunner.query(`ALTER TABLE "debt_notes" ALTER COLUMN "gift_value" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "sales_invoices" ALTER COLUMN "gift_value" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "sales_returns" DROP COLUMN "notes"`);
        await queryRunner.query(`ALTER TABLE "sales_returns" DROP COLUMN "refund_method"`);
        await queryRunner.query(`ALTER TABLE "cost_items" ADD CONSTRAINT "FK_a3c7c68028cd696587922b89d02" FOREIGN KEY ("category_id") REFERENCES "cost_item_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "operating_costs" ADD CONSTRAINT "FK_6f6e15860edf01302e013c71a10" FOREIGN KEY ("category_id") REFERENCES "operating_cost_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "operating_costs" ADD CONSTRAINT "FK_3b90deead5283bc358a91a8e19f" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "operating_costs" ADD CONSTRAINT "FK_0d957586da52c9056e580ce1017" FOREIGN KEY ("rice_crop_id") REFERENCES "rice_crops"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rice_crops" ADD CONSTRAINT "FK_62502b294056dcbd3c74fb50590" FOREIGN KEY ("area_of_each_plot_of_land_id") REFERENCES "area_of_each_plot_of_land"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
