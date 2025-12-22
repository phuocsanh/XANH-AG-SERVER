-- Migration: Thêm column trade_name (hiệu thuốc) vào bảng products
-- Date: 2025-12-22
-- Description: Thêm field để lưu tên thương mại/hiệu thuốc của sản phẩm (BẮT BUỘC)

-- Bước 1: Thêm column trade_name với giá trị mặc định tạm thời
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255) DEFAULT '';

-- Bước 2: Cập nhật trade_name = name cho các sản phẩm cũ (nếu chưa có)
UPDATE products 
SET trade_name = name 
WHERE trade_name IS NULL OR trade_name = '';

-- Bước 3: Đổi column thành NOT NULL
ALTER TABLE products 
ALTER COLUMN trade_name SET NOT NULL;

-- Bước 4: Xóa default constraint
ALTER TABLE products 
ALTER COLUMN trade_name DROP DEFAULT;

-- Thêm comment cho column
COMMENT ON COLUMN products.trade_name IS 'Hiệu thuốc / Tên thương mại của sản phẩm (BẮT BUỘC)';

-- Tạo index để tìm kiếm nhanh hơn
CREATE INDEX IF NOT EXISTS idx_products_trade_name ON products(trade_name);
