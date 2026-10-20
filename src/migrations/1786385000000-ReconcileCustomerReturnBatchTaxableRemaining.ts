import { MigrationInterface, QueryRunner } from 'typeorm';
import { BATCH_TAXABLE_EVIDENCE_SQL } from './helpers/batch-taxable-evidence';

export class ReconcileCustomerReturnBatchTaxableRemaining1786385000000 implements MigrationInterface {
  name = 'ReconcileCustomerReturnBatchTaxableRemaining1786385000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE inventories batch
      SET taxable_remaining_quantity=evidence.expected_tax
      FROM (${BATCH_TAXABLE_EVIDENCE_SQL}) evidence
      WHERE batch.id=evidence.id AND batch.code LIKE 'RETURN-%'
        AND evidence.expected_tax IS NOT NULL
        AND batch.taxable_remaining_quantity IS DISTINCT FROM evidence.expected_tax
    `);
  }

  public async down(): Promise<void> {}
}
