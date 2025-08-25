-- ===== SALES INVOICE QUERIES =====

-- name: CreateSalesInvoice :one
INSERT INTO sales_invoices (
    invoice_code, customer_name, customer_phone, customer_email, customer_address,
    created_by_user_id, total_amount, total_items, discount_amount, final_amount,
    payment_method, payment_status, notes, status, invoice_date, delivery_date
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
) RETURNING *;

-- name: GetSalesInvoice :one
SELECT * FROM sales_invoices WHERE id = $1;

-- name: GetSalesInvoiceByCode :one
SELECT * FROM sales_invoices WHERE invoice_code = $1;

-- name: ListSalesInvoices :many
SELECT * FROM sales_invoices 
WHERE ($1::integer IS NULL OR status = $1)
  AND ($2::integer IS NULL OR payment_status = $2)
  AND ($3::text IS NULL OR customer_phone = $3)
  AND ($4::timestamp IS NULL OR invoice_date >= $4)
  AND ($5::timestamp IS NULL OR invoice_date <= $5)
ORDER BY invoice_date DESC, id DESC
LIMIT $6 OFFSET $7;

-- name: CountSalesInvoices :one
SELECT COUNT(*) FROM sales_invoices 
WHERE ($1::integer IS NULL OR status = $1)
  AND ($2::integer IS NULL OR payment_status = $2)
  AND ($3::text IS NULL OR customer_phone = $3)
  AND ($4::timestamp IS NULL OR invoice_date >= $4)
  AND ($5::timestamp IS NULL OR invoice_date <= $5);

-- name: UpdateSalesInvoice :one
UPDATE sales_invoices 
SET customer_name = COALESCE($2, customer_name),
    customer_phone = COALESCE($3, customer_phone),
    customer_email = COALESCE($4, customer_email),
    customer_address = COALESCE($5, customer_address),
    total_amount = COALESCE($6, total_amount),
    total_items = COALESCE($7, total_items),
    discount_amount = COALESCE($8, discount_amount),
    final_amount = COALESCE($9, final_amount),
    payment_method = COALESCE($10, payment_method),
    payment_status = COALESCE($11, payment_status),
    notes = COALESCE($12, notes),
    status = COALESCE($13, status),
    delivery_date = COALESCE($14, delivery_date),
    completed_date = COALESCE($15, completed_date),
    updated_at = NOW()
WHERE id = $1 
RETURNING *;

-- name: UpdateSalesInvoiceStatus :one
UPDATE sales_invoices 
SET status = $2, updated_at = NOW()
WHERE id = $1 
RETURNING *;

-- name: UpdateSalesInvoicePaymentStatus :one
UPDATE sales_invoices 
SET payment_status = $2, updated_at = NOW()
WHERE id = $1 
RETURNING *;

-- name: DeleteSalesInvoice :exec
DELETE FROM sales_invoices WHERE id = $1;

-- ===== SALES INVOICE ITEMS QUERIES =====

-- name: CreateSalesInvoiceItem :one
INSERT INTO sales_invoice_items (
    invoice_id, product_id, quantity, unit_price, total_price,
    discount_percent, discount_amount, final_price, notes
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetSalesInvoiceItems :many
SELECT sii.*, p.product_name 
FROM sales_invoice_items sii
LEFT JOIN products p ON sii.product_id = p.id
WHERE sii.invoice_id = $1 
ORDER BY sii.id;

-- name: GetSalesInvoiceItem :one
SELECT sii.*, p.product_name 
FROM sales_invoice_items sii
LEFT JOIN products p ON sii.product_id = p.id
WHERE sii.id = $1;

-- name: UpdateSalesInvoiceItem :one
UPDATE sales_invoice_items 
SET quantity = COALESCE($2, quantity),
    unit_price = COALESCE($3, unit_price),
    total_price = COALESCE($4, total_price),
    discount_percent = COALESCE($5, discount_percent),
    discount_amount = COALESCE($6, discount_amount),
    final_price = COALESCE($7, final_price),
    notes = COALESCE($8, notes),
    updated_at = NOW()
WHERE id = $1 
RETURNING *;

-- name: DeleteSalesInvoiceItem :exec
DELETE FROM sales_invoice_items WHERE id = $1;

-- name: DeleteSalesInvoiceItemsByInvoiceID :exec
DELETE FROM sales_invoice_items WHERE invoice_id = $1;

-- ===== SALES REPORTS QUERIES =====

-- name: GetSalesInvoicesByDateRange :many
SELECT * FROM sales_invoices 
WHERE invoice_date >= $1 AND invoice_date <= $2
  AND status != 5  -- Không tính phiếu đã hủy
ORDER BY invoice_date DESC;

-- name: GetTopSellingProducts :many
SELECT p.id, p.product_name, 
       SUM(sii.quantity) as total_quantity_sold,
       SUM(sii.final_price::numeric) as total_revenue
FROM sales_invoice_items sii
JOIN products p ON sii.product_id = p.id
JOIN sales_invoices si ON sii.invoice_id = si.id
WHERE si.status IN (3, 4)  -- Chỉ tính phiếu đã giao hàng hoặc hoàn thành
  AND ($1::timestamp IS NULL OR si.invoice_date >= $1)
  AND ($2::timestamp IS NULL OR si.invoice_date <= $2)
GROUP BY p.id, p.product_name
ORDER BY total_revenue DESC
LIMIT $3;

-- name: GetSalesRevenueByDateRange :one
SELECT 
    COUNT(DISTINCT si.id) as total_invoices,
    SUM(si.final_amount::numeric) as total_revenue,
    SUM(si.total_items) as total_items_sold,
    AVG(si.final_amount::numeric) as average_order_value
FROM sales_invoices si
WHERE si.status IN (3, 4)  -- Chỉ tính phiếu đã giao hàng hoặc hoàn thành
  AND si.invoice_date >= $1 
  AND si.invoice_date <= $2;

-- name: GetCustomerOrderHistory :many
SELECT * FROM sales_invoices 
WHERE customer_phone = $1
ORDER BY invoice_date DESC
LIMIT $2 OFFSET $3;

-- name: CountCustomerOrders :one
SELECT COUNT(*) FROM sales_invoices WHERE customer_phone = $1;

-- name: GetSalesInvoicesByStatus :many
SELECT * FROM sales_invoices 
WHERE status = $1
ORDER BY invoice_date DESC
LIMIT $2 OFFSET $3;

-- name: CountSalesInvoicesByStatus :one
SELECT COUNT(*) FROM sales_invoices WHERE status = $1;

-- name: GetPendingPaymentInvoices :many
SELECT * FROM sales_invoices 
WHERE payment_status IN (1, 2)  -- Chưa thanh toán hoặc thanh toán một phần
  AND status != 5  -- Không phải phiếu đã hủy
ORDER BY invoice_date ASC
LIMIT $1 OFFSET $2;

-- name: CountPendingPaymentInvoices :one
SELECT COUNT(*) FROM sales_invoices 
WHERE payment_status IN (1, 2) AND status != 5;

-- ===== INVENTORY INTEGRATION QUERIES =====

-- name: CheckProductStock :one
SELECT product_quantity FROM products WHERE id = $1;

-- name: UpdateProductStockAfterSale :exec
UPDATE products 
SET product_quantity = product_quantity - $2,
    product_selled = product_selled + $2,
    updated_at = NOW()
WHERE id = $1 AND product_quantity >= $2;

-- name: UpdateProductStockAfterCancel :exec
UPDATE products 
SET product_quantity = product_quantity + $2,
    product_selled = GREATEST(product_selled - $2, 0),
    updated_at = NOW()
WHERE id = $1;

-- name: GetLowStockProductsForSales :many
SELECT id, product_name, product_quantity 
FROM products 
WHERE product_quantity <= $1 
  AND is_published = true
ORDER BY product_quantity ASC;

-- ===== VALIDATION QUERIES =====

-- name: CheckInvoiceExists :one
SELECT EXISTS(SELECT 1 FROM sales_invoices WHERE id = $1);

-- name: CheckInvoiceCodeExists :one
SELECT EXISTS(SELECT 1 FROM sales_invoices WHERE invoice_code = $1);

-- name: CheckProductExists :one
SELECT EXISTS(SELECT 1 FROM products WHERE id = $1);

-- name: GetInvoiceStatus :one
SELECT status FROM sales_invoices WHERE id = $1;