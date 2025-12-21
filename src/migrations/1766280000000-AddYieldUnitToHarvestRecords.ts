import { MigrationInterface, QueryRunner } from "typeorm";

export class AddYieldUnitToHarvestRecords1766280000000 implements MigrationInterface {
    name = 'AddYieldUnitToHarvestRecords1766280000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "harvest_records" ADD "yield_unit" character varying(10) NOT NULL DEFAULT 'kg'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "harvest_records" DROP COLUMN "yield_unit"`);
    }

}
