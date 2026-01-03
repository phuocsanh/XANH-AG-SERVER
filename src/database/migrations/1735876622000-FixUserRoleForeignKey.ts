import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration để fix foreign key constraint cho users.role_id
 * Xóa constraint cũ (nếu có) và tạo lại đúng
 */
export class FixUserRoleForeignKey1735876622000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Xóa foreign key constraint cũ (nếu tồn tại)
        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP CONSTRAINT IF EXISTS "FK_a3ffb1c0c8416b9fc6f907b7433"
        `);

        // 2. Tạo lại foreign key constraint đúng
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD CONSTRAINT "FK_users_role_id" 
            FOREIGN KEY ("role_id") 
            REFERENCES "roles"("id") 
            ON DELETE SET NULL 
            ON UPDATE CASCADE
        `);

        console.log('✅ Fixed foreign key constraint for users.role_id');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback: xóa constraint mới và tạo lại cũ
        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP CONSTRAINT IF EXISTS "FK_users_role_id"
        `);

        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD CONSTRAINT "FK_a3ffb1c0c8416b9fc6f907b7433" 
            FOREIGN KEY ("role_id") 
            REFERENCES "roles"("id")
        `);
    }
}
