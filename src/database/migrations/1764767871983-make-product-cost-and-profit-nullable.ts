import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeProductCostAndProfitNullable1764767871983 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "average_cost_price" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "profit_margin_percent" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "profit_margin_percent" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "average_cost_price" SET NOT NULL`);
    }

}
