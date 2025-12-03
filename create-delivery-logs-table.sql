-- Migration: Tạo bảng delivery_logs để theo dõi chi phí giao hàng
-- Mục đích: Quản lý chi tiết từng chuyến giao hàng cho khách

CREATE TABLE IF NOT EXISTS delivery_logs (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  distance_km DECIMAL(10,2),
  fuel_cost DECIMAL(15,2) DEFAULT 0,
  driver_cost DECIMAL(15,2) DEFAULT 0,
  other_costs DECIMAL(15,2) DEFAULT 0,
  total_cost DECIMAL(15,2) NOT NULL,
  driver_name VARCHAR(255),
  vehicle_plate VARCHAR(50),
  delivery_address TEXT,
  status VARCHAR(50) DEFAULT 'completed',
  notes TEXT,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index cho tìm kiếm nhanh
CREATE INDEX idx_delivery_logs_invoice ON delivery_logs(invoice_id);
CREATE INDEX idx_delivery_logs_date ON delivery_logs(delivery_date);
CREATE INDEX idx_delivery_logs_status ON delivery_logs(status);
CREATE INDEX idx_delivery_logs_created_at ON delivery_logs(created_at);

-- Comment cho bảng
COMMENT ON TABLE delivery_logs IS 'Lịch sử giao hàng - theo dõi chi phí từng chuyến giao hàng';
COMMENT ON COLUMN delivery_logs.fuel_cost IS 'Chi phí xăng xe';
COMMENT ON COLUMN delivery_logs.driver_cost IS 'Chi phí tài xế (nếu thuê ngoài)';
COMMENT ON COLUMN delivery_logs.other_costs IS 'Chi phí khác (phà, qua đêm...)';
COMMENT ON COLUMN delivery_logs.total_cost IS 'Tổng chi phí = fuel_cost + driver_cost + other_costs';
