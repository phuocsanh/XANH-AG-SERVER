import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng products - thông tin sản phẩm
 * Migration được tạo tự động từ InitialSchema.ts
 */
export class CreateProducts1756915768001 implements MigrationInterface {
  name = 'CreateProducts1756915768001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng products...');
    
    // Tạo bảng products
    await queryRunner.query(`CREATE TABLE "products" ("id" SERIAL NOT NULL, "product_name" character varying NOT NULL, "product_price" character varying NOT NULL, "product_status" integer, "product_thumb" character varying NOT NULL, "product_pictures" text array NOT NULL DEFAULT '{}', "product_videos" text array NOT NULL DEFAULT '{}', "product_ratings_average" character varying, "product_description" character varying, "product_slug" character varying, "product_quantity" integer, "product_type" integer NOT NULL, "sub_product_type" integer array NOT NULL DEFAULT '{}', "discount" character varying, "product_discounted_price" character varying NOT NULL, "product_selled" integer, "product_attributes" jsonb NOT NULL, "is_draft" boolean, "is_published" boolean, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "average_cost_price" character varying NOT NULL, "profit_margin_percent" character varying NOT NULL, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng products...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
