import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalesReturnIdToPaymentAllocations1779100000000
  implements MigrationInterface
{
  name = 'AddSalesReturnIdToPaymentAllocations1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" ADD "sales_return_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_payment_allocations_sales_return" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_sales_return"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_allocations" DROP COLUMN "sales_return_id"`,
    );
  }
}
