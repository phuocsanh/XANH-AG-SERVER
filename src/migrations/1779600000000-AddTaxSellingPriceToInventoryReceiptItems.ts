import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaxSellingPriceToInventoryReceiptItems1779600000000
  implements MigrationInterface
{
  name = 'AddTaxSellingPriceToInventoryReceiptItems1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_items" ADD "tax_selling_price" numeric(15,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_receipt_items" DROP COLUMN "tax_selling_price"`,
    );
  }
}
