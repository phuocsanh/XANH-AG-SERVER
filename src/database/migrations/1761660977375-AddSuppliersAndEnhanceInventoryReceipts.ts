import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuppliersAndEnhanceInventoryReceipts1761660977375
  implements MigrationInterface
{
  name = 'AddSuppliersAndEnhanceInventoryReceipts1761660977375';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."suppliers_status_enum" AS ENUM('active', 'inactive', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "suppliers" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "code" character varying NOT NULL, "address" character varying, "phone" character varying, "email" character varying, "contact_person" character varying, "status" "public"."suppliers_status_enum" NOT NULL DEFAULT 'active', "notes" character varying, "created_by" integer NOT NULL, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_6f01a03dcb1aa33822e19534cd6" UNIQUE ("code"), CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" DROP COLUMN IF EXISTS "supplier_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" DROP COLUMN IF EXISTS "supplier_contact"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" DROP COLUMN IF EXISTS "created_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" ADD COLUMN IF NOT EXISTS "supplier_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" ADD COLUMN IF NOT EXISTS "created_by" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" ADD COLUMN IF NOT EXISTS "updated_by" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" ADD COLUMN IF NOT EXISTS "deleted_by" integer`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "inventory_receipts" ADD CONSTRAINT "FK_a2f4585641b14ffa257f8d32e8c" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" DROP CONSTRAINT "FK_a2f4585641b14ffa257f8d32e8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" DROP COLUMN "deleted_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" DROP COLUMN "updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" DROP COLUMN "created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" DROP COLUMN "supplier_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" ADD "created_by_user_id" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" ADD "supplier_contact" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_receipts" ADD "supplier_name" character varying`,
    );
    await queryRunner.query(`DROP TABLE "suppliers"`);
    await queryRunner.query(`DROP TYPE "public"."suppliers_status_enum"`);
  }
}
