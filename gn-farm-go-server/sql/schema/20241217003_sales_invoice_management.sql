-- +goose Up
-- Bảng phiếu bán hàng
CREATE TABLE IF NOT EXISTS sales_invoices (
    id SERIAL PRIMARY KEY,
    invoice_code VARCHAR(50) UNIQUE NOT NULL, -- Mã phiếu bán hàng (tự động sinh)
    customer_name VARCHAR(200), -- Tên khách hàng
    customer_phone VARCHAR(20), -- Số điện thoại khách hàng
    customer_email VARCHAR(100), -- Email khách hàng
    customer_address TEXT, -- Địa chỉ khách hàng
    created_by_user_id INTEGER NOT NULL, -- Người lập phiếu
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0, -- Tổng giá trị phiếu bán hàng
    total_items INTEGER NOT NULL DEFAULT 0, -- Tổng số lượng sản phẩm
    discount_amount DECIMAL(15,2) DEFAULT 0, -- Số tiền giảm giá
    final_amount DECIMAL(15,2) NOT NULL DEFAULT 0, -- Số tiền cuối cùng sau giảm giá
    payment_method VARCHAR(50) DEFAULT 'CASH', -- Phương thức thanh toán: CASH, BANK_TRANSFER, CARD
    payment_status INTEGER DEFAULT 1, -- 1: Chưa thanh toán, 2: Đã thanh toán một phần, 3: Đã thanh toán đủ
    notes TEXT, -- Ghi chú
    status INTEGER DEFAULT 1, -- 1: Nháp, 2: Đã xác nhận, 3: Đã giao hàng, 4: Hoàn thành, 5: Hủy
    invoice_date TIMESTAMP NOT NULL DEFAULT NOW(), -- Ngày lập phiếu
    delivery_date TIMESTAMP, -- Ngày giao hàng dự kiến
    completed_date TIMESTAMP, -- Ngày hoàn thành
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Bảng chi tiết sản phẩm trong phiếu bán hàng
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL, -- Liên kết với bảng products
    quantity INTEGER NOT NULL, -- Số lượng bán
    unit_price DECIMAL(15,2) NOT NULL, -- Giá bán đơn vị
    total_price DECIMAL(15,2) NOT NULL, -- Tổng giá (quantity * unit_price)
    discount_percent DECIMAL(5,2) DEFAULT 0, -- Phần trăm giảm giá cho sản phẩm
    discount_amount DECIMAL(15,2) DEFAULT 0, -- Số tiền giảm giá cho sản phẩm
    final_price DECIMAL(15,2) NOT NULL, -- Giá cuối cùng sau giảm giá
    notes TEXT, -- Ghi chú cho sản phẩm
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes cho hiệu suất truy vấn
CREATE INDEX IF NOT EXISTS idx_sales_invoices_code ON sales_invoices(invoice_code);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_phone ON sales_invoices(customer_phone);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_payment_status ON sales_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice ON sales_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_product ON sales_invoice_items(product_id);

-- +goose Down
DROP TABLE IF EXISTS sales_invoice_items;
DROP TABLE IF EXISTS sales_invoices;