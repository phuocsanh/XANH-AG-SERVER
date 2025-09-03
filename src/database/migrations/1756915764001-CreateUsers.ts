import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng users - thông tin người dùng
 * Migration được tạo tự động từ InitialSchema.ts
 */
export class CreateUsers1756915764001 implements MigrationInterface {
  name = 'CreateUsers1756915764001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng users...');
    
    // Tạo bảng users
    await queryRunner.query(`CREATE TABLE "users" ("user_id" SERIAL NOT NULL, "user_account" character varying NOT NULL, "user_password" character varying NOT NULL, "user_salt" character varying NOT NULL, "user_login_time" TIMESTAMP, "user_logout_time" TIMESTAMP, "user_login_ip" character varying, "user_created_at" TIMESTAMP NOT NULL DEFAULT now(), "user_updated_at" TIMESTAMP NOT NULL DEFAULT now(), "is_two_factor_enabled" boolean, CONSTRAINT "PK_96aac72f1574b88752e9fb00089" PRIMARY KEY ("user_id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng users...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
