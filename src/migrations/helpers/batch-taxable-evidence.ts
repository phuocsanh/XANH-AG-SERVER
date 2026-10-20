/** Phân loại nguồn từng lô; NULL nghĩa là chưa đủ căn cứ, không phải không thuế. */
export const BATCH_TAXABLE_EVIDENCE_SQL = `
  WITH return_allocations AS (
    SELECT item.id AS item_id,item.product_id, sales_return.status, sales_return.code AS return_code,
      COALESCE(item.base_quantity,item.quantity * COALESCE(item.conversion_factor,1)) AS line_quantity,
      CASE WHEN jsonb_typeof(allocation->'batchId')='number'
        AND allocation->>'batchId' ~ '^[1-9][0-9]*$'
        THEN (allocation->>'batchId')::numeric END AS batch_id,
      CASE WHEN jsonb_typeof(allocation->'quantity')='number'
        THEN (allocation->>'quantity')::numeric END AS quantity,
      CASE WHEN jsonb_typeof(allocation->'taxableQuantity')='number'
        THEN (allocation->>'taxableQuantity')::numeric END AS tax
    FROM sales_return_items item
    JOIN sales_returns sales_return ON sales_return.id=item.sales_return_id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(item.stock_allocations::jsonb)='array'
        THEN item.stock_allocations::jsonb ELSE '[]'::jsonb END
    ) allocation
  ), return_destinations AS (
    SELECT allocation.*,
      COUNT(*) OVER (PARTITION BY allocation.batch_id) AS destination_matches,
      COALESCE(destination.product_id=allocation.product_id
        AND destination.code='RETURN-' || allocation.return_code
        AND destination.deleted_at IS NULL
        AND destination.original_quantity=allocation.quantity
        AND destination.remaining_quantity>=0
        AND destination.remaining_quantity<=destination.original_quantity
        AND (SELECT COUNT(*) FROM inventory_transactions creation
          WHERE creation.product_id=allocation.product_id AND creation.type='IN'
            AND creation.reference_type='STOCK_IN' AND creation.reference_id=destination.id
            AND creation.quantity=allocation.quantity AND creation.deleted_at IS NULL)=1,
        false) AS valid_destination
    FROM return_allocations allocation
    LEFT JOIN inventories destination ON destination.id=allocation.batch_id
  ), return_line_totals AS (
    SELECT item_id,SUM(quantity) AS quantity,
      BOOL_AND(batch_id IS NOT NULL AND quantity IS NOT NULL AND tax IS NOT NULL
        AND quantity>0 AND tax>=0 AND tax<=quantity
        AND valid_destination AND destination_matches=1) AS valid
    FROM return_destinations GROUP BY item_id
  ), return_sources AS (
    SELECT allocation.batch_id, COUNT(*) AS matches,
      BOOL_AND(allocation.status='approved' AND line.valid
        AND allocation.line_quantity>0 AND line.quantity=allocation.line_quantity) AS valid,
      MIN(allocation.product_id) AS min_product_id, MAX(allocation.product_id) AS max_product_id,
      MIN('RETURN-' || allocation.return_code) AS min_code, MAX('RETURN-' || allocation.return_code) AS max_code,
      SUM(allocation.quantity) AS quantity, SUM(allocation.tax) AS tax
    FROM return_allocations allocation JOIN return_line_totals line ON line.item_id=allocation.item_id
    WHERE allocation.batch_id IS NOT NULL GROUP BY allocation.batch_id
  ), product_outflow AS (
    SELECT product_id,SUM(-quantity) AS quantity
    FROM inventory_transactions
    WHERE type='OUT' AND reference_type IN ('SALE','SALE_GIFT') AND deleted_at IS NULL
    GROUP BY product_id
  ), allocation_outflow AS (
    SELECT allocation.product_id,SUM(allocation.quantity) AS quantity,
      BOOL_AND(allocation.quantity>0 AND source.product_id=allocation.product_id
        AND source.id IS NOT NULL) AS valid
    FROM sales_invoice_item_stock_allocations allocation
    LEFT JOIN inventories source ON source.id=allocation.inventory_batch_id
    GROUP BY allocation.product_id
  ), batch_outflow AS (
    SELECT inventory_batch_id,SUM(quantity) AS quantity
    FROM sales_invoice_item_stock_allocations GROUP BY inventory_batch_id
  ), evidence AS (
    SELECT batch.id,batch.product_id,batch.code,batch.original_quantity,
      batch.remaining_quantity,batch.taxable_remaining_quantity AS current_tax,
      receipt_item.taxable_quantity * COALESCE(receipt_item.conversion_factor,1) AS receipt_tax,
      COALESCE(return_source.matches,0) AS return_matches,
      COALESCE(return_source.valid,false)
        AND return_source.matches=1
        AND return_source.min_product_id=batch.product_id
        AND return_source.max_product_id=batch.product_id
        AND return_source.min_code=batch.code AND return_source.max_code=batch.code
        AND return_source.quantity=batch.original_quantity
        AND EXISTS (SELECT 1 FROM inventory_transactions creation
          WHERE creation.product_id=batch.product_id AND creation.type='IN'
            AND creation.reference_type='STOCK_IN' AND creation.reference_id=batch.id
            AND creation.quantity=batch.original_quantity AND creation.deleted_at IS NULL) AS valid_return,
      return_source.tax AS return_tax,
      COALESCE(
        batch.code LIKE 'LOT-%' AND receipt_item.id IS NOT NULL
        AND receipt_item.product_id=batch.product_id
        AND receipt_item.deleted_at IS NULL AND receipt.deleted_at IS NULL
        AND receipt.status IN ('approved','completed')
        AND receipt_item.quantity>0 AND COALESCE(receipt_item.conversion_factor,1)>0
        AND receipt_item.taxable_quantity>=0
        AND receipt_item.taxable_quantity<=receipt_item.quantity
        AND batch.original_quantity=receipt_item.quantity * COALESCE(receipt_item.conversion_factor,1)
        AND (receipt_item.base_quantity IS NULL OR receipt_item.base_quantity=batch.original_quantity)
        AND (SELECT COUNT(*) FROM inventories sibling
          WHERE sibling.receipt_item_id=receipt_item.id AND sibling.code LIKE 'LOT-%'
            AND sibling.deleted_at IS NULL)=1
        AND (SELECT COUNT(*) FROM inventory_transactions creation
          WHERE creation.product_id=batch.product_id AND creation.type='IN'
            AND creation.reference_type='STOCK_IN' AND creation.reference_id=batch.id
            AND creation.receipt_item_id=receipt_item.id
            AND creation.quantity=batch.original_quantity AND creation.deleted_at IS NULL)=1,
        false
      ) AS valid_receipt,
      NOT EXISTS (
        SELECT 1 FROM inventory_transactions movement
        WHERE movement.product_id=batch.product_id AND movement.deleted_at IS NULL
          AND NOT COALESCE((
            (movement.type='OUT' AND movement.reference_type IN ('SALE','SALE_GIFT') AND movement.quantity<0)
            OR (movement.type='IN' AND movement.reference_type='STOCK_IN' AND (
              movement.reference_id=batch.id OR EXISTS (
                SELECT 1 FROM inventories origin
                WHERE origin.id=movement.reference_id AND origin.product_id=batch.product_id
                  AND origin.code LIKE 'LOT-%' AND origin.receipt_item_id IS NOT NULL
              )
            ))
          ),false)
      ) AND (
        batch.original_quantity=batch.remaining_quantity
        OR ((SELECT COUNT(*) FROM inventories source WHERE source.product_id=batch.product_id)=1
          AND product_outflow.quantity=batch.original_quantity-batch.remaining_quantity)
        OR (batch_outflow.quantity=batch.original_quantity-batch.remaining_quantity
          AND allocation_outflow.valid AND allocation_outflow.quantity=product_outflow.quantity)
      ) AS depletion_only
    FROM inventories batch
    LEFT JOIN inventory_receipt_items receipt_item ON receipt_item.id=batch.receipt_item_id
    LEFT JOIN inventory_receipts receipt ON receipt.id=receipt_item.receipt_id
    LEFT JOIN return_sources return_source ON return_source.batch_id=batch.id
    LEFT JOIN product_outflow ON product_outflow.product_id=batch.product_id
    LEFT JOIN allocation_outflow ON allocation_outflow.product_id=batch.product_id
    LEFT JOIN batch_outflow ON batch_outflow.inventory_batch_id=batch.id
    WHERE batch.deleted_at IS NULL
  ), classified AS (
    SELECT evidence.*,
      CASE
        WHEN original_quantity IS NULL OR remaining_quantity IS NULL
          OR original_quantity<0 OR remaining_quantity<0 OR remaining_quantity>original_quantity
          THEN 'invalid_quantity'
        WHEN remaining_quantity=0 THEN 'exhausted'
        WHEN return_matches>0 THEN CASE
          WHEN valid_return AND (return_tax=0 OR return_tax=original_quantity OR depletion_only)
            THEN 'return_snapshot' ELSE 'unresolved_return' END
        WHEN code LIKE 'RETURN-%' THEN 'unresolved_return'
        WHEN valid_receipt THEN CASE
          WHEN receipt_tax=0 THEN 'receipt_non_tax'
          WHEN receipt_tax=original_quantity THEN 'receipt_full_tax'
          WHEN depletion_only THEN 'receipt_mixed_depletion'
          ELSE 'unresolved_mixed_movements' END
        ELSE 'unresolved_source'
      END AS source
    FROM evidence
  )
  SELECT id,product_id,code,original_quantity,remaining_quantity,current_tax,source,
    CASE source
      WHEN 'exhausted' THEN 0
      WHEN 'return_snapshot' THEN LEAST(return_tax,remaining_quantity)
      WHEN 'receipt_non_tax' THEN 0
      WHEN 'receipt_full_tax' THEN remaining_quantity
      WHEN 'receipt_mixed_depletion' THEN LEAST(receipt_tax,remaining_quantity)
      ELSE NULL
    END AS expected_tax
  FROM classified
`;

export interface BatchTaxableEvidence {
  id: number;
  product_id: number;
  code: string | null;
  original_quantity: string;
  remaining_quantity: string;
  current_tax: string | null;
  source: string;
  expected_tax: string | null;
}

export function productTaxableRepairPlanSql(evidenceQuery: string): string {
  return `
    WITH balances AS (
      SELECT product.id,product.name,product.quantity,product.taxable_quantity_stock AS old_tax,
        SUM(evidence.remaining_quantity) AS physical,SUM(evidence.expected_tax) AS new_tax,
        COUNT(*) FILTER (WHERE evidence.remaining_quantity>0 AND evidence.expected_tax IS NULL) AS unresolved
      FROM products product JOIN (${evidenceQuery}) evidence ON evidence.product_id=product.id
      WHERE product.deleted_at IS NULL GROUP BY product.id
    )
    SELECT id,name,old_tax,new_tax FROM balances
    WHERE unresolved=0 AND physical=quantity AND new_tax>=0 AND new_tax<=quantity
      AND new_tax=ROUND(new_tax,2) AND old_tax IS DISTINCT FROM new_tax
  `;
}
