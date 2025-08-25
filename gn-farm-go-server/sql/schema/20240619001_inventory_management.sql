-- +goose Up
-- Bảng phiếu nhập kho
CREATE TABLE IF NOT EXISTS inventory_receipts (
    id SERIAL PRIMARY KEY,
    receipt_code VARCHAR(50) UNIQUE NOT NULL, -- Mã phiếu nhập (tự động sinh)
    supplier_name VARCHAR(200), -- Tên nhà cung cấp
    supplier_contact VARCHAR(100), -- Thông tin liên hệ nhà cung cấp
    created_by_user_id INTEGER NOT NULL, -- Người lập phiếu
    checked_by_user_id INTEGER, -- Người kiểm tra hàng
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0, -- Tổng giá trị phiếu nhập
    total_items INTEGER NOT NULL DEFAULT 0, -- Tổng số lượng sản phẩm
    notes TEXT, -- Ghi chú
    status INTEGER DEFAULT 1, -- 1: Chờ xử lý, 2: Đã kiểm tra, 3: Đã nhập kho, 4: Hủy
    receipt_date TIMESTAMP NOT NULL DEFAULT NOW(), -- Ngày nhập
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Bảng chi tiết sản phẩm trong phiếu nhập
CREATE TABLE IF NOT EXISTS inventory_receipt_items (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES inventory_receipts(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL, -- Liên kết với bảng products
    quantity INTEGER NOT NULL, -- Số lượng nhập
    unit_price DECIMAL(15,2) NOT NULL, -- Giá nhập đơn vị
    total_price DECIMAL(15,2) NOT NULL, -- Tổng giá (quantity * unit_price)
    expiry_date DATE, -- Ngày hết hạn (nếu có)
    batch_number VARCHAR(100), -- Số lô hàng
    notes TEXT, -- Ghi chú cho sản phẩm
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Bảng lịch sử tồn kho (để tracking)
CREATE TABLE IF NOT EXISTS inventory_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    receipt_item_id INTEGER REFERENCES inventory_receipt_items(id),
    change_type VARCHAR(20) NOT NULL, -- 'IN' (nhập), 'OUT' (xuất), 'ADJUST' (điều chỉnh)
    quantity_before INTEGER NOT NULL,
    quantity_change INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    unit_price DECIMAL(15,2),
    reason TEXT,
    created_by_user_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_receipts_code ON inventory_receipts(receipt_code);
CREATE INDEX IF NOT EXISTS idx_inventory_receipts_date ON inventory_receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_inventory_receipts_status ON inventory_receipts(status);
CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_receipt ON inventory_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_product ON inventory_receipt_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_product ON inventory_history(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_type ON inventory_history(change_type);

-- +goose Down
DROP TABLE IF EXISTS inventory_history;
DROP TABLE IF EXISTS inventory_receipt_items;
DROP TABLE IF EXISTS inventory_receipts;
