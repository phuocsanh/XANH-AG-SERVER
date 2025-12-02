-- Script để thêm cột large_labor_days vào bảng rice_crops
-- Chạy script này nếu migration tự động gặp vấn đề

-- Kiểm tra và thêm cột large_labor_days nếu chưa tồn tại
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rice_crops' 
        AND column_name = 'large_labor_days'
    ) THEN
        ALTER TABLE rice_crops 
        ADD COLUMN large_labor_days DECIMAL(10, 2) NOT NULL DEFAULT 0;
        
        COMMENT ON COLUMN rice_crops.large_labor_days IS 'Số công lớn (diện tích tính theo công)';
        
        RAISE NOTICE 'Đã thêm cột large_labor_days vào bảng rice_crops';
    ELSE
        RAISE NOTICE 'Cột large_labor_days đã tồn tại trong bảng rice_crops';
    END IF;
END $$;
