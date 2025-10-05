import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration để loại bỏ trường isActive khỏi bảng product_types
 * Chỉ sử dụng trường status để quản lý trạng thái
 */
export class RemoveIsActiveFromProductTypes1759653000000 implements MigrationInterface {
    name = 'RemoveIsActiveFromProductTypes1759653000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Loại bỏ cột is_active khỏi bảng product_types
        await queryRunner.query(`ALTER TABLE "product_types" DROP COLUMN "is_active"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Thêm lại cột is_active nếu cần rollback
        await queryRunner.query(`ALTER TABLE "product_types" ADD "is_active" boolean NOT NULL DEFAULT true`);
    }
}