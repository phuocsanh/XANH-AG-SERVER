-- Script SQL để fix toàn bộ dữ liệu created_by trong tất cả các bảng
-- Chạy script này một lần để fix tất cả dữ liệu cũ

-- 1. Lấy admin user ID
SELECT id, account FROM users ORDER BY id ASC LIMIT 1;
-- Kết quả: id = 3

-- 2. Fix tất cả các bảng có created_by
UPDATE inventory_receipts SET created_by = 3 WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);
UPDATE suppliers SET created_by = 3 WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);
UPDATE sales_invoices SET created_by = 3 WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);
UPDATE debt_notes SET created_by = 3 WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);
UPDATE payments SET created_by = 3 WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);
UPDATE sales_returns SET created_by = 3 WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

-- 3. Kiểm tra lại
SELECT 'inventory_receipts' as table_name, COUNT(*) as invalid_count FROM inventory_receipts WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'suppliers', COUNT(*) FROM suppliers WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'sales_invoices', COUNT(*) FROM sales_invoices WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'debt_notes', COUNT(*) FROM debt_notes WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'payments', COUNT(*) FROM payments WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'sales_returns', COUNT(*) FROM sales_returns WHERE created_by IS NULL OR created_by NOT IN (SELECT id FROM users);

-- Tất cả kết quả phải là 0
