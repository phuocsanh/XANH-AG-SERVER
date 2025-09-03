import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng inventory_receipt_items - chi tiết phiếu nhập kho
 * Migration được tạo tự động từ InitialSchema.ts
 */
export class CreateInventoryReceiptItems1756915773001 implements MigrationInterface {
  name = 'CreateInventoryReceiptItems1756915773001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng inventory_receipt_items...');
    
    // Tạo bảng inventory_receipt_items
    await queryRunner.query(`CREATE TABLE "inventory_receipt_items" ("id" SERIAL NOT NULL, "receipt_id" integer NOT NULL, "product_id" integer NOT NULL, "quantity" integer NOT NULL, "unit_cost" integer NOT NULL, "total_price" integer NOT NULL, "notes" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_eb0153a2da83e07e352569c35e8" PRIMARY KEY ("id"))`);
    
    // Thêm foreign key constraints
    await queryRunner.query(`ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "FK_0aebf1bf41b4f9d9aa80fb5edf8" FOREIGN KEY ("receipt_id") REFERENCES "inventory_receipts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "inventory_receipt_items" ADD CONSTRAINT "FK_326aa296faa7b27063b86c5971d" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng inventory_receipt_items...');
    
    // Xóa foreign key constraints trước
    await queryRunner.query(`ALTER TABLE "inventory_receipt_items" DROP CONSTRAINT "FK_0aebf1bf41b4f9d9aa80fb5edf8"`);
    await queryRunner.query(`ALTER TABLE "inventory_receipt_items" DROP CONSTRAINT "FK_326aa296faa7b27063b86c5971d"`);
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "inventory_receipt_items"`);
  }
}
