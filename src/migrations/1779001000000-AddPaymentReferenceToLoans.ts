import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentReferenceToLoans1779001000000
  implements MigrationInterface
{
  name = 'AddPaymentReferenceToLoans1779001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "loans"
      ADD COLUMN IF NOT EXISTS "payment_id" integer
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_loans_payment'
        ) THEN
          ALTER TABLE "loans"
          ADD CONSTRAINT "FK_loans_payment"
          FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "loans"
      DROP CONSTRAINT IF EXISTS "FK_loans_payment"
    `);
    await queryRunner.query(`
      ALTER TABLE "loans"
      DROP COLUMN IF EXISTS "payment_id"
    `);
  }
}
