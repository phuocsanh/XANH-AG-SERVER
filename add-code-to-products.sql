-- =====================================================
-- Script: Thêm column CODE vào bảng PRODUCTS
-- Database: Supabase (PostgreSQL)
-- Ngày tạo: 2025-12-16
-- =====================================================

-- BƯỚC 1: Thêm column code (nullable tạm thời)
-- =====================================================
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS code VARCHAR(50);

-- BƯỚC 2: Generate code cho tất cả sản phẩm hiện có
-- =====================================================
-- Sử dụng DO block để loop qua từng sản phẩm
DO $$
DECLARE
    product_record RECORD;
    new_code VARCHAR(50);
    counter INTEGER := 0;
BEGIN
    -- Loop qua tất cả sản phẩm chưa có code
    FOR product_record IN 
        SELECT id FROM products WHERE code IS NULL ORDER BY id
    LOOP
        -- Generate code: SP + timestamp + counter
        new_code := 'SP' || 
                    TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || 
                    LPAD(counter::TEXT, 3, '0');
        
        -- Update code cho sản phẩm
        UPDATE products 
        SET code = new_code 
        WHERE id = product_record.id;
        
        -- Tăng counter
        counter := counter + 1;
        
        -- Delay nhỏ mỗi 100 records để tránh quá tải
        IF counter % 100 = 0 THEN
            PERFORM pg_sleep(0.01);
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Đã generate code cho % sản phẩm', counter;
END $$;

-- BƯỚC 3: Thêm unique constraint
-- =====================================================
-- Xóa constraint cũ nếu có
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS UQ_products_code;

-- Thêm constraint mới
ALTER TABLE products 
ADD CONSTRAINT UQ_products_code UNIQUE (code);

-- BƯỚC 4: Đổi column thành NOT NULL
-- =====================================================
ALTER TABLE products 
ALTER COLUMN code SET NOT NULL;

-- BƯỚC 5: Tạo index để tăng tốc search
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_products_code 
ON products(code);

-- =====================================================
-- KIỂM TRA KẾT QUẢ
-- =====================================================
-- Kiểm tra số lượng sản phẩm có code
SELECT 
    COUNT(*) as total_products,
    COUNT(code) as products_with_code,
    COUNT(*) - COUNT(code) as products_without_code
FROM products;

-- Xem 10 sản phẩm đầu tiên với code
SELECT id, code, name 
FROM products 
ORDER BY id 
LIMIT 10;

-- Kiểm tra duplicate code (nên trả về 0 rows)
SELECT code, COUNT(*) as count
FROM products
GROUP BY code
HAVING COUNT(*) > 1;

-- =====================================================
-- ROLLBACK (nếu cần)
-- =====================================================
-- Uncomment các dòng dưới nếu muốn rollback

-- -- Xóa index
-- DROP INDEX IF EXISTS idx_products_code;

-- -- Xóa constraint
-- ALTER TABLE products DROP CONSTRAINT IF EXISTS UQ_products_code;

-- -- Xóa column
-- ALTER TABLE products DROP COLUMN IF EXISTS code;
