import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUniqueConstraintFromInventoryReturnReceiptId1765255918000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Xóa ràng buộc unique trên receipt_id trong bảng inventory_returns
        // Tên constraint được lấy từ log lỗi của user: UQ_a66152495cfbba7ecade455be94
        await queryRunner.query(`ALTER TABLE "inventory_returns" DROP CONSTRAINT IF EXISTS "UQ_a66152495cfbba7ecade455be94"`);
        
        // Cũng xóa index unique nếu có (thường constraint tạo index đi kèm)
        // Nếu constraint name khác index name, lệnh dưới sẽ đảm bảo xóa index
        // Tuy nhiên với TypeORM, drop constraint thường là đủ. 
        // Để chắc chắn, ta drop index nếu nó tồn tại dưới tên constraint
        // await queryRunner.query(`DROP INDEX IF EXISTS "UQ_a66152495cfbba7ecade455be94"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback: Thêm lại ràng buộc unique
        await queryRunner.query(`ALTER TABLE "inventory_returns" ADD CONSTRAINT "UQ_a66152495cfbba7ecade455be94" UNIQUE ("receipt_id")`);
    }

}
