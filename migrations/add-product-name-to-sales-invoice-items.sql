-- Thêm cột product_name vào bảng sales_invoice_items để lưu snapshot tên sản phẩm tại thời điểm mua
ALTER TABLE sales_invoice_items 
ADD COLUMN product_name VARCHAR(255);

-- Cập nhật dữ liệu cũ: lấy tên từ bảng products cho các record hiện có
UPDATE sales_invoice_items si
SET product_name = p.trade_name
FROM products p
WHERE si.product_id = p.id AND si.product_name IS NULL;

-- Fallback: nếu không có trade_name thì dùng name
UPDATE sales_invoice_items si
SET product_name = p.name
FROM products p
WHERE si.product_id = p.id AND si.product_name IS NULL;

-- Comment
COMMENT ON COLUMN sales_invoice_items.product_name IS 'Tên sản phẩm tại thời điểm mua (snapshot)';
