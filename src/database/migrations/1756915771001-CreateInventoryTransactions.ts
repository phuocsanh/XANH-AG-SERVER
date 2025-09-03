import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng inventory_transactions - giao dịch kho
 * Migration được tạo tự động bởi script create-individual-migrations.js
 */
export class CreateInventoryTransactions1756915771001 implements MigrationInterface {
  name = 'CreateInventoryTransactions1756915771001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Tạo bảng inventory_transactions...');
    
    // Tạo bảng inventory_transactions
    await queryRunner.query(`CREATE TABLE "inventory_transactions" ("id" SERIAL NOT NULL, "product_id" integer NOT NULL, "transaction_type" character varying NOT NULL, "quantity" integer NOT NULL, "unit_cost_price" character varying NOT NULL, "total_cost_value" character varying NOT NULL, "remaining_quantity" integer NOT NULL, "new_average_cost" character varying NOT NULL, "receipt_item_id" integer, "reference_type" character varying, "reference_id" integer, "notes" character varying, "created_by_user_id" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9b7144851f08f9eededde7edd42" PRIMARY KEY ("id"))`);
    
    // Không có foreign key constraints
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa bảng inventory_transactions...');
    
    
    // Xóa bảng
    await queryRunner.query(`DROP TABLE "inventory_transactions"`);
  }
}
