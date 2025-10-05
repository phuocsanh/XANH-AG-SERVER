import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm các trường status và deletedAt vào bảng product_subtype_relations
 * Hỗ trợ soft delete và quản lý trạng thái (active/inactive/archived)
 */
export class AddStatusAndSoftDeleteToProductSubtypeRelations1759416696002 implements MigrationInterface {
  name = 'AddStatusAndSoftDeleteToProductSubtypeRelations1759416696002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Thêm trường status và deletedAt vào bảng product_subtype_relations...');
    
    // Thêm trường status với enum type
    await queryRunner.query(`
      CREATE TYPE "product_subtype_relations_status_enum" AS ENUM('active', 'inactive', 'archived')
    `);
    
    await queryRunner.query(`
      ALTER TABLE "product_subtype_relations" 
      ADD "status" "product_subtype_relations_status_enum" NOT NULL DEFAULT 'active'
    `);
    
    // Thêm trường deletedAt cho soft delete
    await queryRunner.query(`
      ALTER TABLE "product_subtype_relations" 
      ADD "deleted_at" TIMESTAMP
    `);
    
    // Tạo index cho trường deletedAt để tối ưu hiệu suất query
    await queryRunner.query(`
      CREATE INDEX "IDX_product_subtype_relations_deleted_at" ON "product_subtype_relations" ("deleted_at")
    `);
    
    // Tạo index cho trường status để tối ưu hiệu suất query
    await queryRunner.query(`
      CREATE INDEX "IDX_product_subtype_relations_status" ON "product_subtype_relations" ("status")
    `);
    
    console.log('Đã thêm thành công trường status và deletedAt vào bảng product_subtype_relations');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Xóa trường status và deletedAt khỏi bảng product_subtype_relations...');
    
    // Xóa các index
    await queryRunner.query(`DROP INDEX "IDX_product_subtype_relations_status"`);
    await queryRunner.query(`DROP INDEX "IDX_product_subtype_relations_deleted_at"`);
    
    // Xóa trường deletedAt
    await queryRunner.query(`ALTER TABLE "product_subtype_relations" DROP COLUMN "deleted_at"`);
    
    // Xóa trường status
    await queryRunner.query(`ALTER TABLE "product_subtype_relations" DROP COLUMN "status"`);
    
    // Xóa enum type
    await queryRunner.query(`DROP TYPE "product_subtype_relations_status_enum"`);
    
    console.log('Đã xóa thành công trường status và deletedAt khỏi bảng product_subtype_relations');
  }
}