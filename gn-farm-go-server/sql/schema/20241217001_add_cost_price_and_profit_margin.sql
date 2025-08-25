-- +goose Up
-- Thêm cột giá vốn trung bình và phần trăm lợi nhuận mong muốn vào bảng products
ALTER TABLE products 
ADD COLUMN average_cost_price DECIMAL(15,2) DEFAULT 0 NOT NULL,
ADD COLUMN profit_margin_percent DECIMAL(5,2) DEFAULT 15.00 NOT NULL; -- Mặc định 15% lợi nhuận

-- Thêm comment cho các cột mới
COMMENT ON COLUMN products.average_cost_price IS 'Giá vốn trung bình gia quyền của sản phẩm';
COMMENT ON COLUMN products.profit_margin_percent IS 'Phần trăm lợi nhuận mong muốn (VD: 15.00 = 15%)';

-- Cập nhật giá bán dựa trên giá vốn và lợi nhuận cho các sản phẩm hiện có
-- Giả sử giá hiện tại là giá vốn, tính ngược lại average_cost_price
UPDATE products 
SET average_cost_price = product_price * 0.85, -- Giả sử giá hiện tại có 15% lợi nhuận
    profit_margin_percent = 15.00
WHERE average_cost_price = 0;

-- +goose Down
-- Xóa các cột đã thêm
ALTER TABLE products 
DROP COLUMN IF EXISTS average_cost_price,
DROP COLUMN IF EXISTS profit_margin_percent;