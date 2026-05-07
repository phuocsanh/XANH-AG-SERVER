import { AppDataSource } from '../config/data-source';

type TxRow = {
  id: number;
  product_id: number;
  type: 'IN' | 'OUT';
  quantity: string | number;
  unit_cost_price: string | number;
  total_value: string | number;
  remaining_quantity: string | number | null;
  new_average_cost: string | number | null;
  reference_type: string | null;
  reference_id: number | null;
  receipt_item_id: number | null;
  created_at: Date | string;
};

type BatchSeedRow = {
  batch_id: number;
  product_id: number;
  tx_id: number;
  quantity: string | number;
  total_value: string | number;
  receipt_unit_cost: string | number | null;
};

type ProductRow = {
  id: number;
  name: string;
  quantity: string | number;
};

type WorkingBatch = {
  key: string;
  productId: number;
  sourceTxId: number;
  inventoryBatchId: number | null;
  remainingQuantity: number;
  unitCost: number;
};

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');
const productIdsArg = args.find((arg) => arg.startsWith('--product-ids='));
const productIdsValue = productIdsArg?.split('=')[1] ?? '';
const productIds = productIdsArg
  ? productIdsValue
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id))
  : [90, 91, 92, 93, 94, 95, 96, 97, 98, 100, 101];

const round2 = (value: number) => Math.round(value * 100) / 100;
const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const asNumber = (value: string | number | null | undefined) => Number(value || 0);

async function main() {
  if (productIds.length === 0) {
    throw new Error('No product ids provided.');
  }

  await AppDataSource.initialize();

  try {
    const params = [productIds];

    const products = (await AppDataSource.query(
      `
        SELECT id, name, quantity
        FROM products
        WHERE id = ANY($1::int[])
        ORDER BY id
      `,
      params,
    )) as ProductRow[];

    const batchSeeds = (await AppDataSource.query(
      `
        SELECT
          b.id AS batch_id,
          b.product_id,
          it.id AS tx_id,
          it.quantity,
          it.total_value,
          iri.unit_cost AS receipt_unit_cost
        FROM inventories b
        INNER JOIN inventory_transactions it
          ON it.reference_type = 'STOCK_IN'
         AND it.reference_id = b.id
         AND it.type = 'IN'
         AND it.deleted_at IS NULL
        LEFT JOIN inventory_receipt_items iri
          ON iri.id = b.receipt_item_id
        WHERE b.product_id = ANY($1::int[])
          AND b.deleted_at IS NULL
      `,
      params,
    )) as BatchSeedRow[];

    const txRows = (await AppDataSource.query(
      `
        SELECT
          id,
          product_id,
          type,
          quantity,
          unit_cost_price,
          total_value,
          remaining_quantity,
          new_average_cost,
          reference_type,
          reference_id,
          receipt_item_id,
          created_at
        FROM inventory_transactions
        WHERE deleted_at IS NULL
          AND product_id = ANY($1::int[])
        ORDER BY product_id ASC, created_at ASC, id ASC
      `,
      params,
    )) as TxRow[];

    const batchSeedByTxId = new Map<number, BatchSeedRow>();
    for (const row of batchSeeds) {
      batchSeedByTxId.set(row.tx_id, row);
    }

    const updates: Array<{
      txId: number;
      productId: number;
      expectedUnitCost: number;
      expectedTotalValue: number;
      expectedRemainingQuantity: number;
      expectedNewAverageCost: number;
      currentUnitCost: number;
      currentTotalValue: number;
      currentRemainingQuantity: number;
      currentNewAverageCost: number;
      referenceType: string | null;
      referenceId: number | null;
    }> = [];

    const batchUpdates = new Map<
      number,
      {
        batchId: number;
        productId: number;
        expectedUnitCost: number;
        expectedRemainingQuantity: number;
      }
    >();

    const productSummaries: Array<{
      productId: number;
      productName: string;
      currentProductQuantity: number;
      replayEndingQuantity: number;
      txCount: number;
      mismatchedTxCount: number;
    }> = [];

    for (const product of products) {
      const productTxs = txRows.filter((row) => Number(row.product_id) === Number(product.id));
      const batches: WorkingBatch[] = [];
      let runningQuantity = 0;
      let runningValue = 0;
      let mismatchedTxCount = 0;

      for (const tx of productTxs) {
        const quantity = asNumber(tx.quantity);
        const currentUnitCost = asNumber(tx.unit_cost_price);
        const currentTotalValue = asNumber(tx.total_value);
        const currentRemainingQuantity = asNumber(tx.remaining_quantity);
        const currentNewAverageCost = asNumber(tx.new_average_cost);

        let expectedUnitCost = 0;
        let expectedTotalValue = 0;

        if (tx.type === 'IN') {
          const seed = batchSeedByTxId.get(Number(tx.id));
          const seededUnitCost =
            seed && asNumber(seed.receipt_unit_cost) > 0
              ? asNumber(seed.receipt_unit_cost)
              : quantity !== 0
                ? Math.abs(asNumber(tx.total_value) / quantity)
                : 0;

          expectedUnitCost = round6(seededUnitCost);
          expectedTotalValue = round2(quantity * expectedUnitCost);

          const batchKey =
            seed?.batch_id != null
              ? `batch:${seed.batch_id}`
              : `tx:${tx.id}`;

          batches.push({
            key: batchKey,
            productId: Number(tx.product_id),
            sourceTxId: Number(tx.id),
            inventoryBatchId: seed?.batch_id ?? null,
            remainingQuantity: quantity,
            unitCost: expectedUnitCost,
          });

          if (seed?.batch_id != null) {
            batchUpdates.set(seed.batch_id, {
              batchId: seed.batch_id,
              productId: Number(tx.product_id),
              expectedUnitCost,
              expectedRemainingQuantity: quantity,
            });
          }

          runningQuantity += quantity;
          runningValue += expectedTotalValue;
        } else {
          const requestedQuantity = Math.abs(quantity);
          let remainingToDeduct = requestedQuantity;
          let deductedTotalCost = 0;

          for (const batch of batches) {
            if (remainingToDeduct <= 0) break;
            if (batch.remainingQuantity <= 0) continue;

            const deductFromBatch = Math.min(batch.remainingQuantity, remainingToDeduct);
            deductedTotalCost += deductFromBatch * batch.unitCost;
            batch.remainingQuantity -= deductFromBatch;
            remainingToDeduct -= deductFromBatch;
          }

          if (remainingToDeduct > 0.0001) {
            throw new Error(
              `Product ${product.id} ran out of replay stock at tx ${tx.id}. Missing quantity ${remainingToDeduct}.`,
            );
          }

          expectedTotalValue = round2(-deductedTotalCost);
          expectedUnitCost =
            requestedQuantity > 0 ? round6(deductedTotalCost / requestedQuantity) : 0;

          runningQuantity -= requestedQuantity;
          runningValue -= deductedTotalCost;
        }

        const expectedRemainingQuantity = round6(runningQuantity);
        const expectedNewAverageCost =
          runningQuantity > 0 ? round6(runningValue / runningQuantity) : 0;

        const isMismatch =
          Math.abs(currentUnitCost - expectedUnitCost) >= 0.01 ||
          Math.abs(currentTotalValue - expectedTotalValue) >= 0.01 ||
          Math.abs(currentRemainingQuantity - expectedRemainingQuantity) >= 0.01 ||
          Math.abs(currentNewAverageCost - expectedNewAverageCost) >= 0.01;

        if (isMismatch) {
          mismatchedTxCount += 1;
        }

        updates.push({
          txId: Number(tx.id),
          productId: Number(tx.product_id),
          expectedUnitCost,
          expectedTotalValue,
          expectedRemainingQuantity,
          expectedNewAverageCost,
          currentUnitCost,
          currentTotalValue,
          currentRemainingQuantity,
          currentNewAverageCost,
          referenceType: tx.reference_type,
          referenceId: tx.reference_id,
        });
      }

      productSummaries.push({
        productId: Number(product.id),
        productName: product.name,
        currentProductQuantity: asNumber(product.quantity),
        replayEndingQuantity: round6(runningQuantity),
        txCount: productTxs.length,
        mismatchedTxCount,
      });

      for (const batch of batches) {
        if (batch.inventoryBatchId == null) continue;
        const existing = batchUpdates.get(batch.inventoryBatchId);
        if (!existing) continue;
        existing.expectedRemainingQuantity = round6(batch.remainingQuantity);
      }
    }

    const txMismatches = updates.filter(
      (row) =>
        Math.abs(row.currentUnitCost - row.expectedUnitCost) >= 0.01 ||
        Math.abs(row.currentTotalValue - row.expectedTotalValue) >= 0.01 ||
        Math.abs(row.currentRemainingQuantity - row.expectedRemainingQuantity) >= 0.01 ||
        Math.abs(row.currentNewAverageCost - row.expectedNewAverageCost) >= 0.01,
    );

    const quantityDrift = productSummaries.filter(
      (row) => Math.abs(row.currentProductQuantity - row.replayEndingQuantity) >= 0.01,
    );

    console.log(
      JSON.stringify(
        {
          mode: shouldApply ? 'apply' : 'dry-run',
          productIds,
          productsChecked: productSummaries.length,
          txChecked: updates.length,
          txMismatches: txMismatches.length,
          inventoryBatchUpdates: batchUpdates.size,
          quantityDriftProducts: quantityDrift.length,
        },
        null,
        2,
      ),
    );

    if (quantityDrift.length > 0) {
      console.table(quantityDrift);
    }

    if (txMismatches.length > 0) {
      console.table(
        txMismatches.slice(0, 50).map((row) => ({
          txId: row.txId,
          productId: row.productId,
          ref: `${row.referenceType ?? ''}:${row.referenceId ?? ''}`,
          currentUnitCost: row.currentUnitCost,
          expectedUnitCost: row.expectedUnitCost,
          currentTotalValue: row.currentTotalValue,
          expectedTotalValue: row.expectedTotalValue,
          currentRemainingQty: row.currentRemainingQuantity,
          expectedRemainingQty: row.expectedRemainingQuantity,
        })),
      );
    }

    if (!shouldApply) {
      return;
    }

    await AppDataSource.transaction(async (manager) => {
      for (const row of txMismatches) {
        await manager.query(
          `
            UPDATE inventory_transactions
            SET
              unit_cost_price = $2,
              total_value = $3,
              remaining_quantity = $4,
              new_average_cost = $5,
              updated_at = NOW()
            WHERE id = $1
          `,
          [
            row.txId,
            row.expectedUnitCost,
            row.expectedTotalValue,
            row.expectedRemainingQuantity,
            row.expectedNewAverageCost,
          ],
        );
      }

      for (const batch of batchUpdates.values()) {
        await manager.query(
          `
            UPDATE inventories
            SET
              unit_cost_price = $2,
              remaining_quantity = $3,
              updated_at = NOW()
            WHERE id = $1
          `,
          [batch.batchId, batch.expectedUnitCost, batch.expectedRemainingQuantity],
        );
      }
    });

    console.log('Repaired inventory transactions and receipt-linked batch costs.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
