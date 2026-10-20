import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  BATCH_TAXABLE_EVIDENCE_SQL,
  productTaxableRepairPlanSql,
} from './helpers/batch-taxable-evidence';

export class RepairLegacyBatchTaxableBalances1786386000000 implements MigrationInterface {
  name = 'RepairLegacyBatchTaxableBalances1786386000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Khóa cùng thứ tự với xuất kho; số dư và chứng từ nguồn phải ổn định khi đối soát.
    await queryRunner.query("SET LOCAL lock_timeout='5s'");
    await queryRunner.query("SET LOCAL statement_timeout='60s'");
    await queryRunner.query(
      'SELECT id FROM products WHERE deleted_at IS NULL ORDER BY id FOR UPDATE',
    );
    await queryRunner.query(
      'SELECT id FROM inventories WHERE deleted_at IS NULL ORDER BY product_id,id FOR UPDATE',
    );
    await queryRunner.query(
      'SELECT id FROM inventory_receipts ORDER BY id FOR SHARE',
    );
    await queryRunner.query(
      'SELECT id FROM inventory_receipt_items ORDER BY id FOR SHARE',
    );
    await queryRunner.query(`
      CREATE TEMP TABLE batch_tax_repair_evidence ON COMMIT DROP AS
      ${BATCH_TAXABLE_EVIDENCE_SQL}
    `);
    await queryRunner.query(`
      UPDATE inventories batch
      SET taxable_remaining_quantity=evidence.expected_tax,updated_at=CURRENT_TIMESTAMP
      FROM batch_tax_repair_evidence evidence
      WHERE batch.id=evidence.id AND evidence.expected_tax IS NOT NULL
        AND batch.taxable_remaining_quantity IS DISTINCT FROM evidence.expected_tax
    `);
    await queryRunner.query(`
      UPDATE products product
      SET taxable_quantity_stock=plan.new_tax,updated_at=CURRENT_TIMESTAMP
      FROM (${productTaxableRepairPlanSql('SELECT * FROM batch_tax_repair_evidence')}) plan
      WHERE product.id=plan.id
    `);
    const [invalid] = (await queryRunner.query(`
      SELECT COUNT(*)::integer AS count
      FROM inventories batch JOIN batch_tax_repair_evidence evidence ON evidence.id=batch.id
      WHERE evidence.expected_tax IS NOT NULL AND (
        batch.remaining_quantity IS DISTINCT FROM evidence.remaining_quantity
        OR batch.taxable_remaining_quantity IS DISTINCT FROM evidence.expected_tax
      )
    `)) as Array<{ count: number }>;
    if (!invalid || invalid.count !== 0) {
      throw new Error('Đối soát tồn thuế lô thất bại; rollback migration.');
    }
    await queryRunner.query('DROP TABLE batch_tax_repair_evidence');
  }

  // Rollback số dư sau khi đã bán tiếp có thể làm sai kho; dùng bản sao trước sửa để đối soát.
  public async down(): Promise<void> {}
}
