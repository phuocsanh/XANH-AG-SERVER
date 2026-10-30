import { MigrationInterface, QueryRunner } from 'typeorm';

/** Lưu mức chiết khấu NCC trên từng dòng nhập theo đơn vị kho cơ sở. */
export class AddSupplierRebateRate1786396000000 implements MigrationInterface {
  name = 'AddSupplierRebateRate1786396000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_receipt_items"
      ADD COLUMN IF NOT EXISTS "supplier_rebate_per_base_unit" numeric(15,4) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_receipts"
      ADD COLUMN IF NOT EXISTS "supplier_rebate_total" numeric(15,2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_receipts"
      DROP COLUMN IF EXISTS "supplier_rebate_total"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_receipt_items"
      DROP COLUMN IF EXISTS "supplier_rebate_per_base_unit"
    `);
  }
}
