import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng user_profiles - thông tin chi tiết người dùng
 * Migration được tạo tự động từ InitialSchema.ts
 */
export class CreateUserProfiles1756915765001 implements MigrationInterface {
  name = 'CreateUserProfiles1756915765001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng user_profiles...');
    
    // Tạo bảng user_profiles
    await queryRunner.query(`CREATE TABLE "user_profiles" ("user_id" integer NOT NULL, "user_account" character varying NOT NULL, "user_nickname" character varying, "user_avatar" character varying, "user_state" integer NOT NULL, "user_mobile" character varying, "user_gender" integer, "user_birthday" TIMESTAMP, "user_email" character varying, "user_is_authentication" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6ca9503d77ae39b4b5a6cc3ba88" PRIMARY KEY ("user_id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng user_profiles...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "user_profiles"`);
  }
}
