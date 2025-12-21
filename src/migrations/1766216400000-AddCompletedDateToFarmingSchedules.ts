import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompletedDateToFarmingSchedules1766216400000 implements MigrationInterface {
    name = 'AddCompletedDateToFarmingSchedules1766216400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "farming_schedules" ADD "completed_date" date`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "farming_schedules" DROP COLUMN "completed_date"`);
    }
}
