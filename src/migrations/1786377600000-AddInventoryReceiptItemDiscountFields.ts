import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryReceiptItemDiscountFields1786377600000
  implements MigrationInterface
{
  name = 'AddInventoryReceiptItemDiscountFields1786377600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_receipt_items"
      ADD COLUMN IF NOT EXISTS "discount_amount" numeric(15,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_receipt_items"
      ADD COLUMN IF NOT EXISTS "discount_value" numeric(15,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_receipt_items"
      ADD COLUMN IF NOT EXISTS "discount_type" varchar(20) NOT NULL DEFAULT 'fixed_amount'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_receipt_items"
      DROP COLUMN IF EXISTS "discount_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_receipt_items"
      DROP COLUMN IF EXISTS "discount_value"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_receipt_items"
      DROP COLUMN IF EXISTS "discount_amount"
    `);
  }
}
