import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenSalesInvoiceProfitMargin1779800000000
  implements MigrationInterface
{
  name = 'WidenSalesInvoiceProfitMargin1779800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_invoices"
      ALTER COLUMN "gross_profit_margin" TYPE numeric(10,2)
      USING "gross_profit_margin"::numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_invoices"
      ALTER COLUMN "gross_profit_margin" TYPE numeric(5,2)
      USING LEAST(GREATEST("gross_profit_margin", -999.99), 999.99)::numeric(5,2)
    `);
  }
}
