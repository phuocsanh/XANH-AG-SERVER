import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedCostItemCategories1734670000000 implements MigrationInterface {
    name = 'SeedCostItemCategories1734670000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Seed các loại chi phí canh tác phổ biến
        await queryRunner.query(`
            INSERT INTO cost_item_categories (name, code, icon, color, description, is_active, created_at, updated_at) 
            VALUES 
            ('Phun thuốc', 'PHUN_THUOC', '🐛', '#f5222d', 'Chi phí thuốc trừ sâu, phun thuốc bảo vệ thực vật', true, NOW(), NOW()),
            ('Xạ lúa', 'XA_LUA', '🌾', '#faad14', 'Chi phí gieo hạt, xạ lúa', true, NOW(), NOW()),
            ('Bơm nước', 'BOM_NUOC', '💧', '#1890ff', 'Chi phí tưới tiêu, bơm nước', true, NOW(), NOW()),
            ('Cày xới', 'CAY_XOI', '🚜', '#722ed1', 'Chi phí cày đất, xới đất', true, NOW(), NOW()),
            ('Dặm lúa', 'DAM_LUA', '🌱', '#52c41a', 'Chi phí dặm lúa, chăm sóc', true, NOW(), NOW()),
            ('Nhổ cỏ', 'NHO_CO', '🌿', '#13c2c2', 'Chi phí làm cỏ, nhổ cỏ', true, NOW(), NOW()),
            ('Khác', 'KHAC', '📦', '#8c8c8c', 'Các chi phí khác', true, NOW(), NOW());
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa các categories đã seed
        await queryRunner.query(`
            DELETE FROM cost_item_categories 
            WHERE name IN ('Phun thuốc', 'Xạ lúa', 'Bơm nước', 'Cày xới', 'Dặm lúa', 'Nhổ cỏ', 'Khác');
        `);
    }
}
