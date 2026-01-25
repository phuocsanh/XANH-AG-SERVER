import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableUnaccentExtension1737785220000 implements MigrationInterface {
    name = 'EnableUnaccentExtension1737785220000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Kích hoạt extension unaccent trong PostgreSQL
        // Extension này cho phép tìm kiếm không phân biệt dấu (ví dụ: gõ 'dung' ra 'Dũng')
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
        
        console.log('✅ Đã kích hoạt extension "unaccent" thành công.');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Hủy kích hoạt extension nếu cần rollback
        // Lưu ý: Thông thường không nên DROP extension nếu có nhiều module phụ thuộc
        // await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
    }
}
