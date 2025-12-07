-- Script SQL để fix dữ liệu cũ trong inventory_receipts và suppliers
-- Chạy script này trước khi restart server

-- 1. Kiểm tra user ID đầu tiên (thường là admin)
SELECT id, account FROM users ORDER BY id ASC LIMIT 1;

-- 2. Thay thế <ADMIN_USER_ID> bằng ID từ bước 1, sau đó chạy các lệnh sau:

-- Fix inventory_receipts
UPDATE inventory_receipts 
SET created_by = <ADMIN_USER_ID>
WHERE created_by IS NULL 
   OR created_by NOT IN (SELECT id FROM users);

-- Fix suppliers
UPDATE suppliers 
SET created_by = <ADMIN_USER_ID>
WHERE created_by IS NULL 
   OR created_by NOT IN (SELECT id FROM users);

-- 3. Kiểm tra lại
SELECT COUNT(*) as invalid_receipts 
FROM inventory_receipts 
WHERE created_by IS NULL 
   OR created_by NOT IN (SELECT id FROM users);

SELECT COUNT(*) as invalid_suppliers 
FROM suppliers 
WHERE created_by IS NULL 
   OR created_by NOT IN (SELECT id FROM users);

-- Kết quả phải là 0 cho cả 2 query trên
