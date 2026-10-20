/** Chỉ cho sửa nguồn chưa xuất; lịch sử thiếu phân bổ không được coi là chưa dùng. */
export const RECEIPT_TAX_EDIT_PLAN_SQL = `
  WITH sale_movements AS (
    SELECT product_id,reference_id AS invoice_id,SUM(-quantity) AS quantity,
      BOOL_AND(quantity<0) AS valid,
      COUNT(DISTINCT receipt_item_id) FILTER (WHERE receipt_item_id IS NOT NULL) <= 1
        AND COALESCE(BOOL_AND(receipt_item_id IS DISTINCT FROM $1),true) AS valid_scope,
      MIN(receipt_item_id) FILTER (WHERE receipt_item_id IS NOT NULL) AS scoped_receipt_item_id
    FROM inventory_transactions
    WHERE type='OUT' AND reference_type='SALE' AND deleted_at IS NULL
    GROUP BY product_id,reference_id
  ), allocation_groups AS (
    SELECT allocation.product_id,allocation.invoice_id,SUM(allocation.quantity) AS quantity,
      BOOL_AND(allocation.quantity>0 AND batch.id IS NOT NULL
        AND batch.product_id=allocation.product_id AND batch.receipt_item_id IS NOT NULL
        AND receipt_item.id=batch.receipt_item_id
        AND receipt_item.product_id=allocation.product_id
        AND (allocation.receipt_item_id IS NULL
          OR allocation.receipt_item_id=batch.receipt_item_id)) AS valid
    FROM sales_invoice_item_stock_allocations allocation
    LEFT JOIN inventories batch ON batch.id=allocation.inventory_batch_id
    LEFT JOIN inventory_receipt_items receipt_item ON receipt_item.id=allocation.receipt_item_id
    GROUP BY allocation.product_id,allocation.invoice_id
  ), candidate AS (
    SELECT batch.*,item.quantity AS input_quantity,item.conversion_factor,
      item.taxable_quantity * COALESCE(item.conversion_factor,1) AS input_tax,
      $2::numeric * COALESCE(item.conversion_factor,1) AS new_batch_tax,
      product.quantity AS product_quantity,product.taxable_quantity_stock AS product_tax,
      item.base_quantity,item.batch_number
    FROM inventory_receipt_items item
    JOIN inventory_receipts receipt ON receipt.id=item.receipt_id
    JOIN inventories batch ON batch.receipt_item_id=item.id
    JOIN products product ON product.id=item.product_id
    WHERE item.id=$1 AND item.deleted_at IS NULL AND receipt.deleted_at IS NULL
      AND receipt.status='approved' AND batch.deleted_at IS NULL AND product.deleted_at IS NULL
      AND batch.product_id=item.product_id AND batch.code LIKE 'LOT-%'
  )
  SELECT source.id AS batch_id,source.new_batch_tax,
    source.product_tax + source.new_batch_tax-source.taxable_remaining_quantity AS new_product_tax
  FROM candidate source
  WHERE source.input_quantity>0 AND COALESCE(source.conversion_factor,1)>0
    AND source.original_quantity=source.input_quantity * COALESCE(source.conversion_factor,1)
    AND (source.base_quantity IS NULL OR source.base_quantity=source.original_quantity)
    AND source.remaining_quantity=source.original_quantity
    AND source.batch_number=source.code
    AND source.taxable_remaining_quantity=source.input_tax
    AND source.input_tax>=0 AND source.input_tax<=source.original_quantity
    AND source.new_batch_tax>=0 AND source.new_batch_tax<=source.remaining_quantity
    AND source.new_batch_tax=ROUND(source.new_batch_tax,4)
    AND source.product_tax + source.new_batch_tax-source.taxable_remaining_quantity
      =ROUND(source.product_tax + source.new_batch_tax-source.taxable_remaining_quantity,2)
    AND (SELECT COUNT(*) FROM inventories sibling WHERE sibling.receipt_item_id=$1)=1
    AND (SELECT COUNT(*) FROM inventory_transactions creation
      WHERE creation.product_id=source.product_id AND creation.type='IN'
        AND creation.reference_type='STOCK_IN' AND creation.reference_id=source.id
        AND creation.receipt_item_id=$1 AND creation.quantity=source.original_quantity
        AND creation.deleted_at IS NULL)=1
    AND source.product_quantity=(SELECT SUM(remaining_quantity) FROM inventories
      WHERE product_id=source.product_id AND deleted_at IS NULL)
    AND source.product_tax=(SELECT SUM(COALESCE(taxable_remaining_quantity,0)) FROM inventories
      WHERE product_id=source.product_id AND deleted_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM inventories balance
      WHERE balance.product_id=source.product_id AND balance.deleted_at IS NULL
        AND (balance.remaining_quantity<0 OR balance.taxable_remaining_quantity<0
          OR balance.taxable_remaining_quantity>balance.remaining_quantity
          OR (balance.remaining_quantity>0 AND balance.taxable_remaining_quantity IS NULL)))
    AND NOT EXISTS (SELECT 1 FROM sales_invoice_item_stock_allocations allocation
      WHERE allocation.receipt_item_id=$1 OR allocation.inventory_batch_id=source.id)
    AND NOT EXISTS (SELECT 1 FROM inventory_borrow_items borrowed
      JOIN inventory_borrows borrow ON borrow.id=borrowed.borrow_id
      WHERE (borrowed.receipt_item_id=$1 OR borrowed.batch_id=source.id)
        AND borrow.status IS DISTINCT FROM 'draft')
    AND NOT EXISTS (SELECT 1 FROM inventory_return_items returned
      JOIN inventory_returns return_doc ON return_doc.id=returned.return_id
      WHERE returned.product_id=source.product_id AND return_doc.status IS DISTINCT FROM 'draft'
        AND (returned.receipt_item_id=$1
          OR (returned.receipt_item_id IS NULL AND return_doc.receipt_id IN
            (SELECT receipt_id FROM inventory_receipt_items WHERE id=$1))))
    AND NOT EXISTS (
      SELECT 1 FROM inventory_transactions movement
      WHERE movement.product_id=source.product_id AND NOT COALESCE((
        (movement.deleted_at IS NULL AND movement.type='IN' AND movement.reference_type='STOCK_IN'
          AND EXISTS (SELECT 1 FROM inventories origin
            WHERE origin.id=movement.reference_id AND origin.product_id=source.product_id
              AND origin.code LIKE 'LOT-%' AND origin.receipt_item_id=movement.receipt_item_id
              AND origin.original_quantity=movement.quantity))
        OR (movement.deleted_at IS NULL AND movement.type='OUT'
          AND movement.reference_type='SALE' AND movement.quantity<0)
      ),false)
    )
    AND NOT EXISTS (
      SELECT 1 FROM sale_movements movement
      LEFT JOIN allocation_groups allocation USING(product_id,invoice_id)
      WHERE movement.product_id=source.product_id
        AND (NOT movement.valid OR NOT movement.valid_scope
          OR allocation.product_id IS NULL OR NOT allocation.valid
          OR allocation.quantity<>movement.quantity
          OR (movement.scoped_receipt_item_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM sales_invoice_item_stock_allocations allocation_item
              WHERE allocation_item.product_id=movement.product_id
                AND allocation_item.invoice_id=movement.invoice_id
                AND allocation_item.receipt_item_id IS DISTINCT FROM movement.scoped_receipt_item_id))
        )
    )
`;

export interface ReceiptTaxEditPlan {
  batch_id: number;
  new_batch_tax: string;
  new_product_tax: string;
}
