import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnitSnapshotToInventoryReturnItems1779200000000
  implements MigrationInterface
{
  name = 'AddUnitSnapshotToInventoryReturnItems1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_return_items" ADD "unit_name" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_return_items" ADD "unit_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_return_items" ADD "conversion_factor" numeric(15,6) DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_return_items" ADD "base_quantity" numeric(15,4)`,
    );
    await queryRunner.query(
      `UPDATE "inventory_return_items" SET "conversion_factor" = COALESCE("conversion_factor", 1), "base_quantity" = COALESCE("base_quantity", "quantity")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_return_items" DROP COLUMN "base_quantity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_return_items" DROP COLUMN "conversion_factor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_return_items" DROP COLUMN "unit_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_return_items" DROP COLUMN "unit_name"`,
    );
  }
}
