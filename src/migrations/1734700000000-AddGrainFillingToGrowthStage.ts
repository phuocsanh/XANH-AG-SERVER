import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGrainFillingToGrowthStage1734700000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Kiểm tra xem giá trị đã tồn tại chưa trước khi thêm (đối với Postgres)
        await queryRunner.query(`
            ALTER TYPE "rice_crops_growth_stage_enum" ADD VALUE IF NOT EXISTS 'grain_filling' AFTER 'heading';
        `);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Postgres không hỗ trợ xóa giá trị khỏi enum bằng ALTER TYPE thuận tiện.
    }
}
