import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusAndDeletedAtToProductTypes1759417728294 implements MigrationInterface {
    name = 'AddStatusAndDeletedAtToProductTypes1759417728294'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_product_subtypes_deleted_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_subtypes_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_subtype_relations_deleted_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_subtype_relations_status"`);
        await queryRunner.query(`CREATE TYPE "public"."product_types_status_enum" AS ENUM('active', 'inactive', 'archived')`);
        await queryRunner.query(`ALTER TABLE "product_types" ADD "status" "public"."product_types_status_enum" NOT NULL DEFAULT 'active'`);
        await queryRunner.query(`ALTER TABLE "product_types" ADD "deleted_at" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_types" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "product_types" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."product_types_status_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_product_subtype_relations_status" ON "product_subtype_relations" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_product_subtype_relations_deleted_at" ON "product_subtype_relations" ("deleted_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_product_subtypes_status" ON "product_subtypes" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_product_subtypes_deleted_at" ON "product_subtypes" ("deleted_at") `);
    }

}
