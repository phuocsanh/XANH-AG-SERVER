import { writeFileSync } from 'fs';
import { AppDataSource } from '../config/data-source';
import {
  BATCH_TAXABLE_EVIDENCE_SQL,
  BatchTaxableEvidence,
  productTaxableRepairPlanSql,
} from '../migrations/helpers/batch-taxable-evidence';

interface ProductBalance {
  id: number;
  name: string;
  quantity: string;
  taxable_quantity_stock: string | null;
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.startTransaction('REPEATABLE READ');
    await runner.query('SET TRANSACTION READ ONLY');
    const evidence = (await runner.query(
      BATCH_TAXABLE_EVIDENCE_SQL,
    )) as BatchTaxableEvidence[];
    const products = (await runner.query(`
      SELECT id,name,quantity,taxable_quantity_stock FROM products
      WHERE deleted_at IS NULL ORDER BY id
    `)) as ProductBalance[];
    const productPlan = (await runner.query(
      productTaxableRepairPlanSql(BATCH_TAXABLE_EVIDENCE_SQL),
    )) as Array<{
      id: number;
      name: string;
      old_tax: string | null;
      new_tax: string;
    }>;
    const productChanges = productPlan.map((product) => ({
      id: product.id,
      name: product.name,
      oldTax: product.old_tax === null ? null : Number(product.old_tax),
      newTax: Number(product.new_tax),
    }));
    const physicalMismatches: number[] = [];
    let currentTaxMismatches = 0;
    for (const product of products) {
      const batches = evidence.filter(
        (batch) => batch.product_id === product.id,
      );
      const physical = batches.reduce(
        (sum, batch) => sum + Number(batch.remaining_quantity),
        0,
      );
      const currentTax = batches.reduce(
        (sum, batch) => sum + Number(batch.current_tax || 0),
        0,
      );
      if (
        Math.abs(currentTax - Number(product.taxable_quantity_stock || 0)) >
        0.0001
      )
        currentTaxMismatches++;
      if (Math.abs(physical - Number(product.quantity)) > 0.0001) {
        physicalMismatches.push(product.id);
      }
    }
    const batchChanges = evidence.filter(
      (batch) =>
        batch.expected_tax !== null &&
        (batch.current_tax === null ||
          Number(batch.current_tax) !== Number(batch.expected_tax)),
    );
    const unresolvedPositiveBatches = evidence.filter(
      (batch) =>
        Number(batch.remaining_quantity) > 0 && batch.expected_tax === null,
    );
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        products: products.length,
        batches: evidence.length,
        currentTaxMismatches,
        batchChanges: batchChanges.length,
        productChanges: productChanges.length,
        unresolvedPositiveBatches: unresolvedPositiveBatches.length,
        physicalMismatches: physicalMismatches.length,
      },
      batchChanges,
      productChanges,
      unresolvedPositiveBatches,
      physicalMismatches,
    };
    const output = process.argv
      .find((arg) => arg.startsWith('--output='))
      ?.slice('--output='.length);
    if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(
      JSON.stringify(
        { summary: report.summary, productChanges, unresolvedPositiveBatches },
        null,
        2,
      ),
    );
  } finally {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    await runner.release();
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Không đọc được dữ liệu đối soát tồn thuế.',
  );
  process.exitCode = 1;
});
