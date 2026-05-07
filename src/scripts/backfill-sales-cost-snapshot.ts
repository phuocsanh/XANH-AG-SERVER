import { AppDataSource } from '../config/data-source';

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');
const invoiceIdArg = args.find((arg) => arg.startsWith('--invoice-id='));
const invoiceIdFilter = invoiceIdArg
  ? Number(invoiceIdArg.split('=')[1])
  : undefined;

const getScopedCteSql = (includeExpectedInvoiceFields = false) => `
  WITH posted_invoices AS (
    SELECT
      si.id,
      si.code,
      si.final_amount,
      COALESCE(si.cost_of_goods_sold, 0) AS current_cogs,
      COALESCE(si.gross_profit, 0) AS current_gross_profit,
      COALESCE(si.gross_profit_margin, 0) AS current_gross_profit_margin
    FROM sales_invoices si
    WHERE si.deleted_at IS NULL
      AND si.status IN ('confirmed', 'paid')
      ${invoiceIdFilter !== undefined && Number.isFinite(invoiceIdFilter) ? 'AND si.id = $1' : ''}
  ),
  posted_items AS (
    SELECT
      sii.id,
      sii.invoice_id,
      sii.product_id,
      COALESCE(sii.base_quantity, sii.quantity) AS base_quantity,
      COALESCE(sii.cost_price, 0) AS current_cost_price
    FROM sales_invoice_items sii
    INNER JOIN posted_invoices pi ON pi.id = sii.invoice_id
    WHERE sii.deleted_at IS NULL
  ),
  allocation_expected AS (
    SELECT
      sisa.sales_invoice_item_id,
      SUM(sisa.quantity::numeric) AS allocated_qty,
      SUM(sisa.total_cost::numeric) AS allocated_total_cost
    FROM sales_invoice_item_stock_allocations sisa
    INNER JOIN posted_items pi ON pi.id = sisa.sales_invoice_item_id
    GROUP BY sisa.sales_invoice_item_id
  ),
  tx_expected AS (
    SELECT
      it.reference_id AS invoice_id,
      it.product_id,
      ABS(it.total_value::numeric) AS tx_total_cost
    FROM inventory_transactions it
    INNER JOIN posted_invoices pi ON pi.id = it.reference_id
    WHERE it.deleted_at IS NULL
      AND it.type = 'OUT'
      AND it.reference_type = 'SALE'
  ),
  item_expected AS (
    SELECT
      pi.id AS item_id,
      pi.invoice_id,
      pi.product_id,
      pi.base_quantity,
      pi.current_cost_price,
      CASE
        WHEN ae.sales_invoice_item_id IS NOT NULL AND COALESCE(ae.allocated_qty, 0) > 0
          THEN ROUND(ae.allocated_total_cost / ae.allocated_qty, 2)
        WHEN COALESCE(pi.base_quantity, 0) > 0
          THEN ROUND(COALESCE(tx.tx_total_cost, 0) / pi.base_quantity, 2)
        ELSE 0
      END AS expected_cost_price,
      CASE
        WHEN ae.sales_invoice_item_id IS NOT NULL
          THEN ROUND(COALESCE(ae.allocated_total_cost, 0), 2)
        ELSE ROUND(COALESCE(tx.tx_total_cost, 0), 2)
      END AS expected_total_cost,
      CASE
        WHEN ae.sales_invoice_item_id IS NOT NULL THEN 'allocation'
        ELSE 'inventory_transaction'
      END AS source
    FROM posted_items pi
    LEFT JOIN allocation_expected ae
      ON ae.sales_invoice_item_id = pi.id
    LEFT JOIN tx_expected tx
      ON tx.invoice_id = pi.invoice_id
     AND tx.product_id = pi.product_id
  ),
  invoice_expected AS (
    SELECT
      p.id AS invoice_id,
      p.code,
      p.final_amount,
      p.current_cogs,
      p.current_gross_profit,
      p.current_gross_profit_margin,
      ROUND(COALESCE(SUM(ie.expected_total_cost), 0), 2) AS expected_cogs,
      ROUND(p.final_amount - COALESCE(SUM(ie.expected_total_cost), 0), 2) AS expected_gross_profit,
      CASE
        WHEN p.final_amount > 0
          THEN ROUND(((p.final_amount - COALESCE(SUM(ie.expected_total_cost), 0)) / p.final_amount) * 100, 2)
        ELSE 0
      END AS expected_gross_profit_margin
      ${includeExpectedInvoiceFields ? `,
      COUNT(*) FILTER (
        WHERE ABS(COALESCE(ie.current_cost_price, 0) - COALESCE(ie.expected_cost_price, 0)) >= 0.01
      ) AS mismatched_items` : ''}
    FROM posted_invoices p
    LEFT JOIN item_expected ie ON ie.invoice_id = p.id
    GROUP BY
      p.id,
      p.code,
      p.final_amount,
      p.current_cogs,
      p.current_gross_profit,
      p.current_gross_profit_margin
  )
`;

async function main() {
  await AppDataSource.initialize();

  try {
    const params =
      invoiceIdFilter !== undefined && Number.isFinite(invoiceIdFilter)
        ? [invoiceIdFilter]
        : [];

    const summaryRows = await AppDataSource.query(
      `
        ${getScopedCteSql(true)}
        SELECT
          (SELECT COUNT(*) FROM posted_invoices) AS total_posted_invoices,
          (
            SELECT COUNT(*)
            FROM invoice_expected ie
            WHERE
              ABS(COALESCE(ie.current_cogs, 0) - COALESCE(ie.expected_cogs, 0)) >= 0.01
              OR ABS(COALESCE(ie.current_gross_profit, 0) - COALESCE(ie.expected_gross_profit, 0)) >= 0.01
              OR ABS(COALESCE(ie.current_gross_profit_margin, 0) - COALESCE(ie.expected_gross_profit_margin, 0)) >= 0.01
              OR COALESCE(ie.mismatched_items, 0) > 0
          ) AS invoices_with_mismatch,
          (
            SELECT COUNT(*)
            FROM item_expected ie
            WHERE ABS(COALESCE(ie.current_cost_price, 0) - COALESCE(ie.expected_cost_price, 0)) >= 0.01
          ) AS item_mismatches
      `,
      params,
    );

    const summary = summaryRows[0] || {
      total_posted_invoices: 0,
      invoices_with_mismatch: 0,
      item_mismatches: 0,
    };

    const sampleRows = await AppDataSource.query(
      `
        ${getScopedCteSql()}
        SELECT
          ie.invoice_id,
          inv.code,
          ie.item_id,
          ie.product_id,
          ie.current_cost_price,
          ie.expected_cost_price,
          inv.current_cogs,
          inv.expected_cogs,
          ie.source
        FROM item_expected ie
        INNER JOIN invoice_expected inv ON inv.invoice_id = ie.invoice_id
        WHERE ABS(COALESCE(ie.current_cost_price, 0) - COALESCE(ie.expected_cost_price, 0)) >= 0.01
        ORDER BY ie.invoice_id ASC, ie.item_id ASC
        LIMIT 50
      `,
      params,
    );

    console.log(
      JSON.stringify(
        {
          mode: shouldApply ? 'apply' : 'dry-run',
          invoiceId: invoiceIdFilter ?? null,
          totalPostedInvoices: Number(summary.total_posted_invoices || 0),
          invoicesWithMismatch: Number(summary.invoices_with_mismatch || 0),
          itemMismatches: Number(summary.item_mismatches || 0),
        },
        null,
        2,
      ),
    );

    if (sampleRows.length > 0) {
      console.table(sampleRows);
    }

    if (!shouldApply) {
      return;
    }

    await AppDataSource.query(
      `
        ${getScopedCteSql()}
        UPDATE sales_invoice_items sii
        SET cost_price = ie.expected_cost_price
        FROM item_expected ie
        WHERE sii.id = ie.item_id
          AND ABS(COALESCE(sii.cost_price, 0) - COALESCE(ie.expected_cost_price, 0)) >= 0.01
      `,
      params,
    );

    await AppDataSource.query(
      `
        ${getScopedCteSql()}
        UPDATE sales_invoices si
        SET
          cost_of_goods_sold = inv.expected_cogs,
          gross_profit = inv.expected_gross_profit,
          gross_profit_margin = inv.expected_gross_profit_margin
        FROM invoice_expected inv
        WHERE si.id = inv.invoice_id
          AND (
            ABS(COALESCE(si.cost_of_goods_sold, 0) - COALESCE(inv.expected_cogs, 0)) >= 0.01
            OR ABS(COALESCE(si.gross_profit, 0) - COALESCE(inv.expected_gross_profit, 0)) >= 0.01
            OR ABS(COALESCE(si.gross_profit_margin, 0) - COALESCE(inv.expected_gross_profit_margin, 0)) >= 0.01
          )
      `,
      params,
    );

    console.log('Updated sales invoice cost snapshots from stock-out data.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
