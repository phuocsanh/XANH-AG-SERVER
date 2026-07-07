import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoansTable1779000000000 implements MigrationInterface {
  name = 'CreateLoansTable1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'loan_status_enum'
        ) THEN
          CREATE TYPE "loan_status_enum" AS ENUM ('active', 'paid', 'overdue', 'cancelled');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "loans" (
        "id" SERIAL NOT NULL,
        "code" character varying(50) NOT NULL,
        "customer_id" integer NOT NULL,
        "loan_date" date NOT NULL,
        "repayment_date" date,
        "principal_amount" numeric(15,2) NOT NULL,
        "monthly_interest_rate" numeric(8,4) NOT NULL DEFAULT '0',
        "loan_days" integer NOT NULL DEFAULT '0',
        "interest_amount" numeric(15,2) NOT NULL DEFAULT '0',
        "total_amount" numeric(15,2) NOT NULL DEFAULT '0',
        "paid_amount" numeric(15,2) NOT NULL DEFAULT '0',
        "remaining_amount" numeric(15,2) NOT NULL DEFAULT '0',
        "payment_id" integer,
        "status" "loan_status_enum" NOT NULL DEFAULT 'active',
        "notes" text,
        "created_by" integer,
        "settled_by" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loans_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_loans_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_loans_customer'
        ) THEN
          ALTER TABLE "loans"
          ADD CONSTRAINT "FK_loans_customer"
          FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_loans_created_by'
        ) THEN
          ALTER TABLE "loans"
          ADD CONSTRAINT "FK_loans_created_by"
          FOREIGN KEY ("created_by") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_loans_settled_by'
        ) THEN
          ALTER TABLE "loans"
          ADD CONSTRAINT "FK_loans_settled_by"
          FOREIGN KEY ("settled_by") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
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
      DROP CONSTRAINT IF EXISTS "FK_loans_settled_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "loans"
      DROP CONSTRAINT IF EXISTS "FK_loans_created_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "loans"
      DROP CONSTRAINT IF EXISTS "FK_loans_customer"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "loans"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "loan_status_enum"`);
  }
}
