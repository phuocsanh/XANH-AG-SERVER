import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng file_references - tham chiếu file
 * Migration được tạo tự động từ InitialSchema.ts
 */
export class CreateFileReferences1756915777001 implements MigrationInterface {
  name = 'CreateFileReferences1756915777001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng file_references...');
    
    // Tạo bảng file_references
    await queryRunner.query(`CREATE TABLE "file_references" ("id" SERIAL NOT NULL, "file_id" integer NOT NULL, "entity_type" character varying NOT NULL, "entity_id" integer NOT NULL, "field_name" character varying, "array_index" integer, "created_by_user_id" integer, "deleted_by_user_id" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_29140177cb876eafdee7340dccc" PRIMARY KEY ("id"))`);
    
    // Thêm foreign key constraints
    await queryRunner.query(`ALTER TABLE "file_references" ADD CONSTRAINT "FK_2f65aba597220b9e04ce2dd90f8" FOREIGN KEY ("file_id") REFERENCES "file_uploads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng file_references...');
    
    // Xóa foreign key constraints trước
    await queryRunner.query(`ALTER TABLE "file_references" DROP CONSTRAINT "FK_2f65aba597220b9e04ce2dd90f8"`);
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "file_references"`);
  }
}
