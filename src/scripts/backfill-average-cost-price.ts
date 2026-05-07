import { AppDataSource } from '../config/data-source';

type AverageCostRow = {
  id: number;
  name: string;
  type: number;
  current_average_cost_price: string;
  receipt_total_value: string;
  receipt_total_quantity: string;
  return_total_value: string;
  return_total_quantity: string;
  expected_average_cost_price: string;
};

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');
const typeArg = args.find((arg) => arg.startsWith('--type='));
const productType = typeArg ? Number(typeArg.split('=')[1]) : undefined;

const toNumber = (value: string | number | null | undefined) =>
  Number(value || 0);

async function main() {
  await AppDataSource.initialize();

  try {
    const params: Array<number | string> = ['approved', 'completed', 'approved'];
    let typeFilterSql = '';

    if (productType !== undefined && Number.isFinite(productType)) {
      params.push(productType);
      typeFilterSql = `AND p."type" = $${params.length}`;
    }

    const rows = await AppDataSource.query(
      `
        WITH receipt_totals AS (
          SELECT
            iri.product_id,
            SUM(iri.total_price) AS total_value,
            SUM(COALESCE(iri.base_quantity, iri.quantity * COALESCE(iri.conversion_factor, 1))) AS total_quantity
          FROM inventory_receipt_items iri
          INNER JOIN inventory_receipts ir ON ir.id = iri.receipt_id
          WHERE iri.deleted_at IS NULL
            AND ir.deleted_at IS NULL
            AND ir.status IN ($1, $2)
          GROUP BY iri.product_id
        ),
        return_totals AS (
          SELECT
            iri.product_id,
            SUM(iri.total_price) AS total_value,
            SUM(COALESCE(iri.base_quantity, iri.quantity * COALESCE(iri.conversion_factor, 1))) AS total_quantity
          FROM inventory_return_items iri
          INNER JOIN inventory_returns ir ON ir.id = iri.return_id
          WHERE iri.deleted_at IS NULL
            AND ir.deleted_at IS NULL
            AND ir.status = $3
          GROUP BY iri.product_id
        )
        SELECT
          p.id,
          p.name,
          p."type",
          COALESCE(p.average_cost_price, '0') AS current_average_cost_price,
          COALESCE(rt.total_value, 0) AS receipt_total_value,
          COALESCE(rt.total_quantity, 0) AS receipt_total_quantity,
          COALESCE(ret.total_value, 0) AS return_total_value,
          COALESCE(ret.total_quantity, 0) AS return_total_quantity,
          CASE
            WHEN COALESCE(rt.total_quantity, 0) - COALESCE(ret.total_quantity, 0) > 0
              THEN ROUND(
                (COALESCE(rt.total_value, 0) - COALESCE(ret.total_value, 0))
                / (COALESCE(rt.total_quantity, 0) - COALESCE(ret.total_quantity, 0)),
                2
              )
            ELSE 0
          END AS expected_average_cost_price
        FROM products p
        LEFT JOIN receipt_totals rt ON rt.product_id = p.id
        LEFT JOIN return_totals ret ON ret.product_id = p.id
        WHERE p.deleted_at IS NULL
          AND (
            COALESCE(rt.total_quantity, 0) > 0
            OR COALESCE(ret.total_quantity, 0) > 0
          )
          ${typeFilterSql}
        ORDER BY p.id
      `,
      params,
    );

    const typedRows = rows as AverageCostRow[];
    const mismatches = typedRows
      .map((row) => {
        const currentAverage = toNumber(row.current_average_cost_price);
        const expectedAverage = toNumber(row.expected_average_cost_price);
        const delta = Number((expectedAverage - currentAverage).toFixed(2));

        return {
          ...row,
          currentAverage,
          expectedAverage,
          delta,
        };
      })
      .filter((row) => Math.abs(row.delta) >= 0.01);

    console.log(
      JSON.stringify(
        {
          mode: shouldApply ? 'apply' : 'dry-run',
          productType: productType ?? null,
          totalProductsWithPurchaseHistory: typedRows.length,
          mismatchedProducts: mismatches.length,
        },
        null,
        2,
      ),
    );

    if (mismatches.length > 0) {
      console.table(
        mismatches.map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          currentAverage: row.currentAverage,
          expectedAverage: row.expectedAverage,
          delta: row.delta,
          receiptQty: toNumber(row.receipt_total_quantity),
          returnQty: toNumber(row.return_total_quantity),
        })),
      );
    }

    if (!shouldApply || mismatches.length === 0) {
      return;
    }

    for (const row of mismatches) {
      await AppDataSource.query(
        `
          UPDATE products
          SET average_cost_price = $2
          WHERE id = $1
        `,
        [row.id, row.expectedAverage.toFixed(2)],
      );
    }

    console.log(
      `Updated ${mismatches.length} products average_cost_price using valid receipts average.`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
