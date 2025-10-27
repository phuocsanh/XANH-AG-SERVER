import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToSymbols1761579051000 implements MigrationInterface {
  name = 'AddStatusToSymbols1761579051000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."symbols_status_enum" AS ENUM('active', 'inactive', 'archived')`,
    );
    await queryRunner.query(
      `ALTER TABLE "symbols" ADD "status" "public"."symbols_status_enum" NOT NULL DEFAULT 'active'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "symbols" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."symbols_status_enum"`);
  }
}
