import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveHealthStatusFromGrowthTrackings1766286000000 implements MigrationInterface {
    name = 'RemoveHealthStatusFromGrowthTrackings1766286000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "growth_trackings" DROP COLUMN "health_status"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "growth_trackings" ADD "health_status" character varying(50) NOT NULL DEFAULT 'healthy'`);
    }

}
