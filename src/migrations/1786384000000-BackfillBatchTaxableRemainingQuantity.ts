import { MigrationInterface, QueryRunner } from 'typeorm';
import { BATCH_TAXABLE_EVIDENCE_SQL } from './helpers/batch-taxable-evidence';

export class BackfillBatchTaxableRemainingQuantity1786384000000 implements MigrationInterface {
  name = 'BackfillBatchTaxableRemainingQuantity1786384000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE inventories batch
      SET taxable_remaining_quantity=evidence.expected_tax
      FROM (${BATCH_TAXABLE_EVIDENCE_SQL}) evidence
      WHERE batch.id=evidence.id AND batch.taxable_remaining_quantity IS NULL
        AND evidence.expected_tax IS NOT NULL
    `);
  }

  // Không xóa số dư có thể đã được dùng cho giao dịch phát sinh sau migration.
  public async down(): Promise<void> {}
}
