-- Migration: Thêm column volume (dung tích/khối lượng) vào bảng products
-- Date: 2025-12-22
-- Description: Thêm field để lưu dung tích/khối lượng của sản phẩm (VD: 450ml, 1 lít, 500g)

-- Thêm column volume
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS volume VARCHAR(50);

-- Thêm comment cho column
COMMENT ON COLUMN products.volume IS 'Dung tích / Khối lượng của sản phẩm (VD: 450ml, 1 lít, 500g)';

-- Tạo index để tìm kiếm nhanh hơn (optional)
CREATE INDEX IF NOT EXISTS idx_products_volume ON products(volume);
