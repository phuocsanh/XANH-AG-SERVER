import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng product_subtype_relations - quan hệ sản phẩm và loại phụ
 * Migration được tạo tự động bởi script create-individual-migrations.js
 */
export class CreateProductSubtypeRelations1756915769001 implements MigrationInterface {
  name = 'CreateProductSubtypeRelations1756915769001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng product_subtype_relations...');
    
    // Tạo bảng product_subtype_relations
    await queryRunner.query(`CREATE TABLE "product_subtype_relations" ("id" SERIAL NOT NULL, "product_id" integer NOT NULL, "subtype_id" integer NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3d665e31eb77a67af3bc3d19cb5" PRIMARY KEY ("id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng product_subtype_relations...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "product_subtype_relations"`);
  }
}
