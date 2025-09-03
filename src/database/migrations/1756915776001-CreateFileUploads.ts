import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng file_uploads - thông tin file upload
 * Migration được tạo tự động bởi script create-individual-migrations.js
 */
export class CreateFileUploads1756915776001 implements MigrationInterface {
  name = 'CreateFileUploads1756915776001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng file_uploads...');
    
    // Tạo bảng file_uploads
    await queryRunner.query(`CREATE TABLE "file_uploads" ("id" SERIAL NOT NULL, "public_id" character varying NOT NULL, "file_url" character varying NOT NULL, "file_name" character varying NOT NULL, "file_type" character varying NOT NULL, "file_size" integer NOT NULL, "folder" character varying, "mime_type" character varying, "reference_count" integer, "is_temporary" boolean, "is_orphaned" boolean, "uploaded_by_user_id" integer, "tags" text array NOT NULL DEFAULT '{}', "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "marked_for_deletion_at" TIMESTAMP, "deleted_at" TIMESTAMP, CONSTRAINT "PK_b3ebfc99a8b660f0bc64a052b42" PRIMARY KEY ("id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng file_uploads...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "file_uploads"`);
  }
}
