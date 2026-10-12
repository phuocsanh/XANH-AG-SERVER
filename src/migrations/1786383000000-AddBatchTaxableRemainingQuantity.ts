import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBatchTaxableRemainingQuantity1786383000000
  implements MigrationInterface
{
  name = 'AddBatchTaxableRemainingQuantity1786383000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventories"
      ADD COLUMN IF NOT EXISTS "taxable_remaining_quantity" numeric(15,4)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventories"
      DROP COLUMN IF EXISTS "taxable_remaining_quantity"
    `);
  }
}
