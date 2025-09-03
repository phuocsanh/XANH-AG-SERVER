import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng inventory_receipts - phiếu nhập kho
 * Migration được tạo tự động từ InitialSchema.ts
 */
export class CreateInventoryReceipts1756915772001 implements MigrationInterface {
  name = 'CreateInventoryReceipts1756915772001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng inventory_receipts...');
    
    // Tạo bảng inventory_receipts
    await queryRunner.query(`CREATE TABLE "inventory_receipts" ("id" SERIAL NOT NULL, "receipt_code" character varying NOT NULL, "supplier_name" character varying, "supplier_contact" character varying, "total_amount" integer NOT NULL, "status" character varying NOT NULL DEFAULT 'draft', "notes" character varying, "created_by_user_id" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "approved_at" TIMESTAMP, "completed_at" TIMESTAMP, "cancelled_at" TIMESTAMP, "cancelled_reason" character varying, CONSTRAINT "UQ_a78905b2a6d5bb0522894f7cf43" UNIQUE ("receipt_code"), CONSTRAINT "PK_03f7acc6403c071df7c8ae6f796" PRIMARY KEY ("id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng inventory_receipts...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "inventory_receipts"`);
  }
}
