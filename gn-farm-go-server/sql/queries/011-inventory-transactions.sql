-- name: CreateInventoryTransaction :one
INSERT INTO inventory_transactions (
    product_id, transaction_type, quantity, unit_cost_price, total_cost_value,
    remaining_quantity, new_average_cost, receipt_item_id, reference_type, 
    reference_id, notes, created_by_user_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
) RETURNING *;

-- name: GetInventoryTransactionsByProduct :many
SELECT * FROM inventory_transactions 
WHERE product_id = $1 
ORDER BY created_at DESC, id DESC
LIMIT $2 OFFSET $3;

-- name: GetLatestInventoryTransaction :one
SELECT * FROM inventory_transactions 
WHERE product_id = $1 
ORDER BY created_at DESC, id DESC 
LIMIT 1;

-- name: GetInventoryTransactionsByReference :many
SELECT * FROM inventory_transactions 
WHERE reference_type = $1 AND reference_id = $2 
ORDER BY created_at DESC;

-- name: CreateInventoryBatch :one
INSERT INTO inventory_batches (
    product_id, batch_code, unit_cost_price, original_quantity, 
    remaining_quantity, expiry_date, receipt_item_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetInventoryBatchesByProduct :many
SELECT * FROM inventory_batches 
WHERE product_id = $1 AND remaining_quantity > 0 
ORDER BY created_at ASC; -- FIFO: lấy lô cũ nhất trước

-- name: UpdateInventoryBatchQuantity :one
UPDATE inventory_batches 
SET remaining_quantity = $2, updated_at = NOW() 
WHERE id = $1 
RETURNING *;

-- name: GetExpiredBatches :many
SELECT * FROM inventory_batches 
WHERE expiry_date IS NOT NULL 
  AND expiry_date <= $1 
  AND remaining_quantity > 0 
ORDER BY expiry_date ASC;

-- name: CalculateWeightedAverageCost :one
SELECT 
    COALESCE(SUM(remaining_quantity * unit_cost_price) / NULLIF(SUM(remaining_quantity), 0), 0) as weighted_average_cost,
    COALESCE(SUM(remaining_quantity), 0) as total_quantity
FROM inventory_batches 
WHERE product_id = $1 AND remaining_quantity > 0;

-- name: UpdateProductAverageCostAndPrice :exec
UPDATE products 
SET 
    average_cost_price = $2,
    product_price = $2 * (1 + profit_margin_percent / 100),
    product_discounted_price = $2 * (1 + profit_margin_percent / 100) * (1 - discount / 100),
    updated_at = NOW()
WHERE id = $1;

-- name: GetProductCostInfo :one
SELECT 
    id, product_name, average_cost_price, profit_margin_percent,
    product_price, product_discounted_price, product_quantity
FROM products 
WHERE id = $1;

-- name: GetLowStockProducts :many
SELECT 
    p.id, p.product_name, p.product_quantity, p.average_cost_price,
    COALESCE(SUM(ib.remaining_quantity), 0) as actual_stock
FROM products p
LEFT JOIN inventory_batches ib ON p.id = ib.product_id AND ib.remaining_quantity > 0
WHERE p.product_quantity <= $1
GROUP BY p.id, p.product_name, p.product_quantity, p.average_cost_price
ORDER BY p.product_quantity ASC;

-- name: GetInventoryValueReport :many
SELECT 
    p.id, p.product_name, p.average_cost_price, p.product_quantity,
    COALESCE(SUM(ib.remaining_quantity), 0) as batch_total_quantity,
    COALESCE(SUM(ib.remaining_quantity * ib.unit_cost_price), 0) as total_inventory_value
FROM products p
LEFT JOIN inventory_batches ib ON p.id = ib.product_id AND ib.remaining_quantity > 0
WHERE p.is_published = true
GROUP BY p.id, p.product_name, p.average_cost_price, p.product_quantity
ORDER BY total_inventory_value DESC;