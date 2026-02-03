import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaxableQuantityToReceiptItems1770087923056 implements MigrationInterface {
    name = 'AddTaxableQuantityToReceiptItems1770087923056'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory_receipt_items" ADD "taxable_quantity" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory_receipt_items" DROP COLUMN "taxable_quantity"`);
    }

}
