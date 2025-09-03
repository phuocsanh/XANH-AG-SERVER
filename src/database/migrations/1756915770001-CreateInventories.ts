import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng inventories - lô hàng tồn kho
 * Migration được tạo tự động bởi script create-individual-migrations.js
 */
export class CreateInventories1756915770001 implements MigrationInterface {
  name = 'CreateInventories1756915770001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng inventories...');
    
    // Tạo bảng inventories
    await queryRunner.query(`CREATE TABLE "inventories" ("id" SERIAL NOT NULL, "product_id" integer NOT NULL, "batch_code" character varying, "unit_cost_price" character varying NOT NULL, "original_quantity" integer NOT NULL, "remaining_quantity" integer NOT NULL, "expiry_date" TIMESTAMP, "manufacturing_date" TIMESTAMP, "supplier_id" integer, "notes" text, "receipt_item_id" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7b1946392ffdcb50cfc6ac78c0e" PRIMARY KEY ("id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng inventories...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "inventories"`);
  }
}
