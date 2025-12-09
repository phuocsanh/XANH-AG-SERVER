import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration xóa payments và payment_allocations (DEV ONLY)
 * Để chuẩn bị cho việc fix debt_notes
 */
export class CleanPaymentsForDevEnvironment1733714400000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🗑️  Xóa payments và payment_allocations (DEV ONLY)...');
        
        // Xóa payment_allocations trước (vì có foreign key)
        await queryRunner.query(`DELETE FROM payment_allocations`);
        console.log(`✅ Đã xóa payment_allocations`);
        
        // Xóa payments
        await queryRunner.query(`DELETE FROM payments`);
        console.log(`✅ Đã xóa payments`);
        
        console.log('✅ Hoàn thành xóa payments!');
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        console.log('⚠️  Rollback: Không thể khôi phục payments đã xóa!');
        console.log('⚠️  Vui lòng restore từ backup nếu cần.');
    }

}
