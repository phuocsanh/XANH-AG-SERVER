import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng product_subtypes - loại phụ sản phẩm
 * Migration được tạo tự động từ InitialSchema.ts
 */
export class CreateProductSubtypes1756915767001 implements MigrationInterface {
  name = 'CreateProductSubtypes1756915767001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng product_subtypes...');
    
    // Tạo bảng product_subtypes
    await queryRunner.query(`CREATE TABLE "product_subtypes" ("id" SERIAL NOT NULL, "subtype_name" character varying NOT NULL, "subtype_code" character varying NOT NULL, "product_type_id" integer NOT NULL, "description" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d9e779e902d53cb5e061fae25f2" UNIQUE ("subtype_code"), CONSTRAINT "PK_575430b6b3a0e6b0c3c19613ff0" PRIMARY KEY ("id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng product_subtypes...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "product_subtypes"`);
  }
}
