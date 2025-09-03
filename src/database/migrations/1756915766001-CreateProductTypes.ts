import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng product_types - loại sản phẩm
 * Migration được tạo tự động từ InitialSchema.ts
 */
export class CreateProductTypes1756915766001 implements MigrationInterface {
  name = 'CreateProductTypes1756915766001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng product_types...');
    
    // Tạo bảng product_types
    await queryRunner.query(`CREATE TABLE "product_types" ("id" SERIAL NOT NULL, "type_name" character varying NOT NULL, "type_code" character varying NOT NULL, "description" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_afcffcf7b9b91846df39b0c3dbc" UNIQUE ("type_code"), CONSTRAINT "PK_6ad7b08e6491a02ebc9ed82019d" PRIMARY KEY ("id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng product_types...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "product_types"`);
  }
}
