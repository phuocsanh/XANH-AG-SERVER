import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Thêm hỗ trợ đăng nhập cho khách hàng
 * 
 * Thực hiện:
 * 1. Thêm cột customer_id vào bảng users
 * 2. Thêm role CUSTOMER vào bảng roles
 * 3. Thêm permissions cho customer
 * 4. Gán permissions cho role CUSTOMER
 */
export class AddCustomerLoginSupport1766310000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm cột customer_id vào bảng users
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
    `);

    // Tạo index để tăng tốc query
    await queryRunner.query(`
      CREATE INDEX idx_users_customer_id ON users(customer_id);
    `);

    // 2. Thêm role CUSTOMER (kiểm tra trước khi thêm)
    await queryRunner.query(`
      INSERT INTO roles (name, code, description, created_at, updated_at) 
      SELECT 'Khách hàng', 'CUSTOMER', 'Khách hàng có thể xem báo cáo và thông tin cá nhân', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = 'CUSTOMER');
    `);

    // 3. Thêm permissions cho CUSTOMER
    const permissions = [
      { name: 'Xem báo cáo lợi nhuận', code: 'VIEW_PROFIT_REPORT', description: 'Xem báo cáo lợi nhuận của mình' },
      { name: 'Xem công nợ', code: 'VIEW_OWN_DEBT', description: 'Xem công nợ của mình' },
      { name: 'Xem lịch sử mua hàng', code: 'VIEW_OWN_INVOICES', description: 'Xem lịch sử mua hàng của mình' },
      { name: 'Xem ruộng lúa', code: 'VIEW_OWN_RICE_CROPS', description: 'Xem ruộng lúa của mình' },
      { name: 'Xem cảnh báo bệnh', code: 'VIEW_DISEASE_WARNING', description: 'Xem cảnh báo bệnh/sâu hại' },
      // Thêm permissions để truy cập các API cần thiết
      { name: 'Xem vụ lúa', code: 'rice_crop:read', description: 'Xem danh sách và chi tiết mảnh ruộng' },
    ];

    for (const perm of permissions) {
      await queryRunner.query(`
        INSERT INTO permissions (name, code, description, created_at, updated_at)
        SELECT '${perm.name}', '${perm.code}', '${perm.description}', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = '${perm.code}');
      `);
    }

    // 4. Gán permissions cho role CUSTOMER
    await queryRunner.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 
        (SELECT id FROM roles WHERE code = 'CUSTOMER'),
        p.id 
      FROM permissions p
      WHERE p.code IN (
        'VIEW_PROFIT_REPORT', 
        'VIEW_OWN_DEBT', 
        'VIEW_OWN_INVOICES', 
        'VIEW_OWN_RICE_CROPS', 
        'VIEW_DISEASE_WARNING',
        'rice_crop:read'
      )
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp 
        WHERE rp.role_id = (SELECT id FROM roles WHERE code = 'CUSTOMER') 
        AND rp.permission_id = p.id
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa role_permissions
    await queryRunner.query(`
      DELETE FROM role_permissions 
      WHERE role_id = (SELECT id FROM roles WHERE code = 'CUSTOMER');
    `);

    // Xóa permissions
    await queryRunner.query(`
      DELETE FROM permissions 
      WHERE code IN ('VIEW_PROFIT_REPORT', 'VIEW_OWN_DEBT', 'VIEW_OWN_INVOICES', 'VIEW_OWN_RICE_CROPS', 'VIEW_DISEASE_WARNING');
    `);

    // Xóa role CUSTOMER
    await queryRunner.query(`
      DELETE FROM roles WHERE code = 'CUSTOMER';
    `);

    // Xóa index
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_customer_id;
    `);

    // Xóa cột customer_id
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS customer_id;
    `);
  }
}
