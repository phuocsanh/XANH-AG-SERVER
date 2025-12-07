import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration để fix dữ liệu cũ trong inventory_receipts trước khi thêm foreign key
 */
export class FixInventoryReceiptsCreatedBy1733568000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Lấy ID của user đầu tiên (thường là admin)
    const adminUser = await queryRunner.query(
      `SELECT id FROM users ORDER BY id ASC LIMIT 1`
    );
    
    if (!adminUser || adminUser.length === 0) {
      throw new Error('Không tìm thấy user nào trong hệ thống. Vui lòng tạo user trước.');
    }
    
    const defaultUserId = adminUser[0].id;
    
    // Cập nhật tất cả các bản ghi có created_by NULL hoặc không hợp lệ
    await queryRunner.query(
      `UPDATE inventory_receipts 
       SET created_by = $1 
       WHERE created_by IS NULL 
       OR created_by NOT IN (SELECT id FROM users)`,
      [defaultUserId]
    );
    
    // Tương tự cho suppliers nếu cần
    await queryRunner.query(
      `UPDATE suppliers 
       SET created_by = $1 
       WHERE created_by IS NULL 
       OR created_by NOT IN (SELECT id FROM users)`,
      [defaultUserId]
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Không cần rollback vì đây là fix dữ liệu
  }
}
