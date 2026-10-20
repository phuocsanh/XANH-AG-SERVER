import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryBorrowTaxableSnapshot1786387000000
  implements MigrationInterface
{
  name = 'AddInventoryBorrowTaxableSnapshot1786387000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_borrow_items"
      ADD COLUMN IF NOT EXISTS "taxable_quantity" numeric(15,4)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_borrow_items"
      DROP COLUMN IF EXISTS "taxable_quantity"
    `);
  }
}
