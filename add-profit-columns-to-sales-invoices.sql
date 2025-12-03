-- Migration: Thêm các cột tính lợi nhuận vào bảng sales_invoices
-- Mục đích: Tự động tính và lưu lợi nhuận mỗi đơn hàng

ALTER TABLE sales_invoices 
ADD COLUMN IF NOT EXISTS cost_of_goods_sold DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_profit DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_profit_margin DECIMAL(5,2) DEFAULT 0;

-- Index để tìm kiếm và báo cáo nhanh
CREATE INDEX IF NOT EXISTS idx_sales_invoices_season_profit 
ON sales_invoices(season_id, gross_profit) WHERE season_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_profit 
ON sales_invoices(customer_id, gross_profit) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_margin
ON sales_invoices(gross_profit_margin);

-- Comment
COMMENT ON COLUMN sales_invoices.cost_of_goods_sold IS 'Tổng giá vốn hàng bán (COGS) = SUM(quantity × average_cost_price)';
COMMENT ON COLUMN sales_invoices.gross_profit IS 'Lợi nhuận gộp = final_amount - cost_of_goods_sold';
COMMENT ON COLUMN sales_invoices.gross_profit_margin IS 'Tỷ suất lợi nhuận gộp (%) = (gross_profit / final_amount) × 100';
