-- name: CreateInventoryReceipt :one
INSERT INTO inventory_receipts (
    receipt_code, supplier_name, supplier_contact, created_by_user_id, 
    checked_by_user_id, total_amount, total_items, notes, status, receipt_date
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) RETURNING *;

-- name: GetInventoryReceipt :one
SELECT * FROM inventory_receipts WHERE id = $1;

-- name: GetInventoryReceiptByCode :one
SELECT * FROM inventory_receipts WHERE receipt_code = $1;

-- name: ListInventoryReceipts :many
SELECT * FROM inventory_receipts 
WHERE ($1::text IS NULL OR supplier_name ILIKE '%' || $1 || '%')
  AND ($2::integer IS NULL OR status = $2)
  AND ($3::timestamp IS NULL OR receipt_date >= $3)
  AND ($4::timestamp IS NULL OR receipt_date <= $4)
ORDER BY receipt_date DESC, id DESC
LIMIT $5 OFFSET $6;

-- name: CountInventoryReceipts :one
SELECT COUNT(*) FROM inventory_receipts 
WHERE ($1::text IS NULL OR supplier_name ILIKE '%' || $1 || '%')
  AND ($2::integer IS NULL OR status = $2)
  AND ($3::timestamp IS NULL OR receipt_date >= $3)
  AND ($4::timestamp IS NULL OR receipt_date <= $4);

-- name: UpdateInventoryReceipt :one
UPDATE inventory_receipts 
SET supplier_name = $2, supplier_contact = $3, checked_by_user_id = $4,
    total_amount = $5, total_items = $6, notes = $7, status = $8, updated_at = NOW()
WHERE id = $1 
RETURNING *;

-- name: DeleteInventoryReceipt :exec
DELETE FROM inventory_receipts WHERE id = $1;

-- name: CreateInventoryReceiptItem :one
INSERT INTO inventory_receipt_items (
    receipt_id, product_id, quantity, unit_price, total_price,
    expiry_date, batch_number, notes
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;

-- name: GetInventoryReceiptItems :many
SELECT * FROM inventory_receipt_items WHERE receipt_id = $1 ORDER BY id;

-- name: GetInventoryReceiptItem :one
SELECT * FROM inventory_receipt_items WHERE id = $1;

-- name: UpdateInventoryReceiptItem :one
UPDATE inventory_receipt_items 
SET quantity = $2, unit_price = $3, total_price = $4,
    expiry_date = $5, batch_number = $6, notes = $7, updated_at = NOW()
WHERE id = $1 
RETURNING *;

-- name: DeleteInventoryReceiptItem :exec
DELETE FROM inventory_receipt_items WHERE id = $1;

-- name: CreateInventoryHistory :one
INSERT INTO inventory_history (
    product_id, receipt_item_id, change_type, quantity_before, 
    quantity_change, quantity_after, unit_price, reason, created_by_user_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetInventoryHistoryByProduct :many
SELECT * FROM inventory_history 
WHERE product_id = $1 
ORDER BY created_at DESC, id DESC
LIMIT $2 OFFSET $3;

-- name: CountInventoryHistoryByProduct :one
SELECT COUNT(*) FROM inventory_history WHERE product_id = $1;

-- name: UpdateProductQuantity :exec
UPDATE products SET product_quantity = $2, updated_at = NOW() WHERE id = $1;
