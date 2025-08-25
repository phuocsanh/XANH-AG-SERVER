/*
#####################################################################
MIGRATION: INVENTORY TRANSACTIONS - HỆ THỐNG GIAO DỊCH KHO
Ngày tạo: 2024-12-17
Phiên bản: 002 (Inventory Transaction System)

Mục đích:
- Triển khai hệ thống theo dõi giao dịch kho chi tiết
- Tính giá trị tồn kho theo phương pháp giá trung bình gia quyền
- Hỗ trợ FIFO (First In First Out) cho quản lý lô hàng
- Theo dõi lịch sử nhập/xuất kho đầy đủ

Các tính năng chính:
- Ghi lại mọi giao dịch nhập/xuất/điều chỉnh
- Tính toán giá vốn trung bình tự động
- Quản lý lô hàng và hạn sử dụng
- Audit trail đầy đủ cho báo cáo tài chính

Tác giả: GN Farm Development Team
#####################################################################
*/

-- +goose Up
-- Bảng giao dịch kho chi tiết để tính giá trung bình gia quyền
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL, -- Liên kết với bảng products
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('IN', 'OUT', 'ADJUST')), -- Loại giao dịch: nhập, xuất, điều chỉnh
    quantity INTEGER NOT NULL, -- Số lượng (âm cho xuất kho)
    unit_cost_price DECIMAL(15,2) NOT NULL, -- Giá vốn đơn vị tại thời điểm giao dịch
    total_cost_value DECIMAL(15,2) NOT NULL, -- Tổng giá trị (quantity * unit_cost_price)
    remaining_quantity INTEGER NOT NULL DEFAULT 0, -- Số lượng còn lại sau giao dịch
    new_average_cost DECIMAL(15,2) NOT NULL DEFAULT 0, -- Giá vốn trung bình mới sau giao dịch
    receipt_item_id INTEGER REFERENCES inventory_receipt_items(id), -- Liên kết với phiếu nhập (nếu có)
    reference_type VARCHAR(50), -- Loại tham chiếu: 'RECEIPT', 'SALE', 'ADJUSTMENT'
    reference_id INTEGER, -- ID tham chiếu (order_id, receipt_id, etc.)
    notes TEXT, -- Ghi chú
    created_by_user_id INTEGER NOT NULL, -- Người thực hiện giao dịch
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Bảng tồn kho hiện tại theo từng lô hàng (FIFO tracking)
CREATE TABLE IF NOT EXISTS inventory_batches (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL, -- Liên kết với bảng products
    batch_code VARCHAR(100), -- Mã lô hàng
    unit_cost_price DECIMAL(15,2) NOT NULL, -- Giá vốn của lô này
    original_quantity INTEGER NOT NULL, -- Số lượng ban đầu của lô
    remaining_quantity INTEGER NOT NULL, -- Số lượng còn lại của lô
    expiry_date DATE, -- Ngày hết hạn
    receipt_item_id INTEGER REFERENCES inventory_receipt_items(id), -- Liên kết với phiếu nhập
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes để tối ưu performance
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference ON inventory_transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_product ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_remaining ON inventory_batches(product_id, remaining_quantity) WHERE remaining_quantity > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON inventory_batches(expiry_date) WHERE expiry_date IS NOT NULL;

-- Comments
COMMENT ON TABLE inventory_transactions IS 'Bảng ghi lại tất cả giao dịch nhập/xuất kho để tính giá trung bình gia quyền';
COMMENT ON TABLE inventory_batches IS 'Bảng theo dõi tồn kho theo từng lô hàng để hỗ trợ FIFO';

COMMENT ON COLUMN inventory_transactions.unit_cost_price IS 'Giá vốn đơn vị tại thời điểm giao dịch';
COMMENT ON COLUMN inventory_transactions.new_average_cost IS 'Giá vốn trung bình mới sau khi thực hiện giao dịch này';
COMMENT ON COLUMN inventory_batches.unit_cost_price IS 'Giá vốn của lô hàng này';
COMMENT ON COLUMN inventory_batches.remaining_quantity IS 'Số lượng còn lại của lô (giảm dần khi bán)';

-- +goose Down
DROP TABLE IF EXISTS inventory_batches;
DROP TABLE IF EXISTS inventory_transactions;