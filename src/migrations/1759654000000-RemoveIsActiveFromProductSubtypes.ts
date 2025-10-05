import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration để loại bỏ trường is_active khỏi bảng product_subtypes
 * Chỉ sử dụng trường status để quản lý trạng thái
 */
export class RemoveIsActiveFromProductSubtypes1759654000000 implements MigrationInterface {
  name = 'RemoveIsActiveFromProductSubtypes1759654000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Loại bỏ cột is_active khỏi bảng product_subtypes
    await queryRunner.query(`ALTER TABLE "product_subtypes" DROP COLUMN "is_active"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Thêm lại cột is_active cho mục đích rollback
    await queryRunner.query(`ALTER TABLE "product_subtypes" ADD "is_active" boolean NOT NULL DEFAULT true`);
  }
}