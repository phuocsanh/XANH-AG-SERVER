-- Migration: Add Return and Adjustment Tables
-- Created: 2024-12-04
-- Description: Tạo bảng inventory_returns, inventory_return_items, inventory_adjustments, inventory_adjustment_items

-- ===== INVENTORY RETURNS TABLE =====
CREATE TABLE IF NOT EXISTS inventory_returns (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    receipt_id INTEGER REFERENCES inventory_receipts(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_by INTEGER NOT NULL,
    updated_by INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_reason TEXT,
    deleted_at TIMESTAMP
);

-- Index cho inventory_returns
CREATE INDEX idx_inventory_returns_code ON inventory_returns(code);
CREATE INDEX idx_inventory_returns_supplier ON inventory_returns(supplier_id);
CREATE INDEX idx_inventory_returns_status ON inventory_returns(status);
CREATE INDEX idx_inventory_returns_created_at ON inventory_returns(created_at);

-- ===== INVENTORY RETURN ITEMS TABLE =====
CREATE TABLE IF NOT EXISTS inventory_return_items (
    id SERIAL PRIMARY KEY,
    return_id INTEGER NOT NULL REFERENCES inventory_returns(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Index cho inventory_return_items
CREATE INDEX idx_inventory_return_items_return ON inventory_return_items(return_id);
CREATE INDEX idx_inventory_return_items_product ON inventory_return_items(product_id);

-- ===== INVENTORY ADJUSTMENTS TABLE =====
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    adjustment_type VARCHAR(10) NOT NULL CHECK (adjustment_type IN ('IN', 'OUT')),
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_by INTEGER NOT NULL,
    updated_by INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_reason TEXT,
    deleted_at TIMESTAMP
);

-- Index cho inventory_adjustments
CREATE INDEX idx_inventory_adjustments_code ON inventory_adjustments(code);
CREATE INDEX idx_inventory_adjustments_type ON inventory_adjustments(adjustment_type);
CREATE INDEX idx_inventory_adjustments_status ON inventory_adjustments(status);
CREATE INDEX idx_inventory_adjustments_created_at ON inventory_adjustments(created_at);

-- ===== INVENTORY ADJUSTMENT ITEMS TABLE =====
CREATE TABLE IF NOT EXISTS inventory_adjustment_items (
    id SERIAL PRIMARY KEY,
    adjustment_id INTEGER NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity_change INTEGER NOT NULL,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Index cho inventory_adjustment_items
CREATE INDEX idx_inventory_adjustment_items_adjustment ON inventory_adjustment_items(adjustment_id);
CREATE INDEX idx_inventory_adjustment_items_product ON inventory_adjustment_items(product_id);

-- ===== COMMENTS =====
COMMENT ON TABLE inventory_returns IS 'Bảng lưu thông tin phiếu xuất trả hàng cho nhà cung cấp';
COMMENT ON TABLE inventory_return_items IS 'Bảng lưu chi tiết sản phẩm trong phiếu xuất trả hàng';
COMMENT ON TABLE inventory_adjustments IS 'Bảng lưu thông tin phiếu điều chỉnh kho';
COMMENT ON TABLE inventory_adjustment_items IS 'Bảng lưu chi tiết sản phẩm trong phiếu điều chỉnh kho';

-- ===== SUCCESS MESSAGE =====
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Created tables: inventory_returns, inventory_return_items, inventory_adjustments, inventory_adjustment_items';
END $$;
