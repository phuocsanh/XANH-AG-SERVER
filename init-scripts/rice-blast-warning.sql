-- =====================================================
-- BẢNG QUẢN LÝ VỊ TRÍ RUỘNG LÚA (CHỈ 1 DÒNG DUY NHẤT)
-- =====================================================
CREATE TABLE IF NOT EXISTS locations (
    id BIGINT PRIMARY KEY DEFAULT 1,
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_location_check CHECK (id = 1)
);

-- Thêm comment cho bảng
COMMENT ON TABLE locations IS 'Bảng lưu vị trí ruộng lúa (chỉ 1 dòng duy nhất)';
COMMENT ON COLUMN locations.id IS 'ID cố định = 1';
COMMENT ON COLUMN locations.name IS 'Tên vị trí (VD: Ruộng nhà ông Tư - Tân Lập, Vũ Thư)';
COMMENT ON COLUMN locations.lat IS 'Vĩ độ (latitude)';
COMMENT ON COLUMN locations.lon IS 'Kinh độ (longitude)';

-- Thêm dữ liệu mặc định (Vũ Thư, Thái Bình)
INSERT INTO locations (id, name, lat, lon, updated_at)
VALUES (1, 'Ruộng nhà ông Tư - Tân Lập, Vũ Thư', 20.4167, 106.3667, NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- BẢNG CẢNH BÁO BỆNH ĐẠO ÔN (CHỈ 1 DÒNG DUY NHẤT)
-- =====================================================
CREATE TABLE IF NOT EXISTS rice_blast_warnings (
    id BIGINT PRIMARY KEY DEFAULT 1,
    generated_at TIMESTAMPTZ NOT NULL,
    risk_level TEXT NOT NULL,
    probability INTEGER NOT NULL CHECK (probability >= 0 AND probability <= 100),
    message TEXT NOT NULL,
    peak_days TEXT,
    daily_data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_warning_check CHECK (id = 1)
);

-- Thêm comment cho bảng
COMMENT ON TABLE rice_blast_warnings IS 'Bảng lưu cảnh báo bệnh đạo ôn mới nhất (chỉ 1 dòng duy nhất)';
COMMENT ON COLUMN rice_blast_warnings.id IS 'ID cố định = 1';
COMMENT ON COLUMN rice_blast_warnings.generated_at IS 'Thời điểm tạo cảnh báo';
COMMENT ON COLUMN rice_blast_warnings.risk_level IS 'Mức độ nguy cơ (AN TOÀN, THẤP, TRUNG BÌNH, CAO, RẤT CAO)';
COMMENT ON COLUMN rice_blast_warnings.probability IS 'Xác suất nhiễm bệnh (0-100%)';
COMMENT ON COLUMN rice_blast_warnings.message IS 'Tin nhắn cảnh báo chi tiết';
COMMENT ON COLUMN rice_blast_warnings.peak_days IS 'Ngày cao điểm (VD: 30/11 - 02/12)';
COMMENT ON COLUMN rice_blast_warnings.daily_data IS 'Dữ liệu chi tiết từng ngày (JSON)';

-- Thêm index để tăng tốc truy vấn
CREATE INDEX IF NOT EXISTS idx_warnings_generated_at ON rice_blast_warnings(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_warnings_risk_level ON rice_blast_warnings(risk_level);

-- Thêm dữ liệu mặc định (placeholder)
INSERT INTO rice_blast_warnings (id, generated_at, risk_level, probability, message, peak_days, daily_data, updated_at)
VALUES (
    1,
    NOW(),
    'ĐANG CHỜ CẬP NHẬT',
    0,
    'Hệ thống đang khởi động. Vui lòng chờ phân tích tự động hoặc bấm "Chạy ngay" để cập nhật.',
    NULL,
    '[]'::jsonb,
    NOW()
)
ON CONFLICT (id) DO NOTHING;
