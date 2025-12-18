import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration để đồng bộ trạng thái quy trình 3 bước mới.
 * Chuyển các bản ghi 'completed' sang 'approved'.
 */
export class RefactorInventoryStatus1734480000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Cập nhật inventory_adjustments
    // completed -> approved
    await queryRunner.query(
      `UPDATE inventory_adjustments 
       SET status = 'approved' 
       WHERE status = 'completed' OR status = '3'`
    );

    // 2. Cập nhật inventory_receipts
    // completed -> approved
    await queryRunner.query(
      `UPDATE inventory_receipts 
       SET status = 'approved' 
       WHERE status = 'completed' OR status = '4'`
    );

    // 3. Cập nhật inventory_returns
    // completed -> approved
    await queryRunner.query(
      `UPDATE inventory_returns 
       SET status = 'approved' 
       WHERE status = 'completed' OR status = '3'`
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Không rollback dữ liệu vì quy trình 4 bước đã bị loại bỏ khỏi code
  }
}
