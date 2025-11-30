import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPeakDaysToWarningTables1733070000000 implements MigrationInterface {
    name = 'AddPeakDaysToWarningTables1733070000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add peak_days column to all 5 warning tables if not exists
        await queryRunner.query(`ALTER TABLE "stem_borer_warnings" ADD COLUMN IF NOT EXISTS "peak_days" text`);
        await queryRunner.query(`ALTER TABLE "gall_midge_warnings" ADD COLUMN IF NOT EXISTS "peak_days" text`);
        await queryRunner.query(`ALTER TABLE "brown_plant_hopper_warnings" ADD COLUMN IF NOT EXISTS "peak_days" text`);
        await queryRunner.query(`ALTER TABLE "sheath_blight_warnings" ADD COLUMN IF NOT EXISTS "peak_days" text`);
        await queryRunner.query(`ALTER TABLE "grain_discoloration_warnings" ADD COLUMN IF NOT EXISTS "peak_days" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "grain_discoloration_warnings" DROP COLUMN IF EXISTS "peak_days"`);
        await queryRunner.query(`ALTER TABLE "sheath_blight_warnings" DROP COLUMN IF EXISTS "peak_days"`);
        await queryRunner.query(`ALTER TABLE "brown_plant_hopper_warnings" DROP COLUMN IF EXISTS "peak_days"`);
        await queryRunner.query(`ALTER TABLE "gall_midge_warnings" DROP COLUMN IF EXISTS "peak_days"`);
        await queryRunner.query(`ALTER TABLE "stem_borer_warnings" DROP COLUMN IF EXISTS "peak_days"`);
    }
}
