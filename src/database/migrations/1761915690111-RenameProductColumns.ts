import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameProductColumns1761915690111 implements MigrationInterface {
  name = 'RenameProductColumns1761915690111';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" RENAME COLUMN "sub_product_type" TO "subProductType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" RENAME COLUMN "discount" TO "discountPercentage"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" RENAME COLUMN "subProductType" TO "sub_product_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" RENAME COLUMN "discountPercentage" TO "discount"`,
    );
  }
}
