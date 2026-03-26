import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVatInputCostFields1774540200000 implements MigrationInterface {
    name = 'AddVatInputCostFields1774540200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory_receipt_items" ADD "vat_unit_cost" numeric(15,2)`);
        await queryRunner.query(`ALTER TABLE "products" ADD "average_vat_input_cost" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "average_vat_input_cost"`);
        await queryRunner.query(`ALTER TABLE "inventory_receipt_items" DROP COLUMN "vat_unit_cost"`);
    }
}
