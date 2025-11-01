import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserProfileIsAuthenticationDefault1761925802171
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cập nhật cột is_authentication để có giá trị mặc định
    await queryRunner.query(
      `ALTER TABLE "user_profiles" ALTER COLUMN "is_authentication" SET DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Hoàn nguyên thay đổi
    await queryRunner.query(
      `ALTER TABLE "user_profiles" ALTER COLUMN "is_authentication" DROP DEFAULT`,
    );
  }
}
