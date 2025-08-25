-- +goose Up
-- Thêm trường image_url vào bảng product_types
ALTER TABLE product_types ADD COLUMN image_url TEXT;

-- Cập nhật dữ liệu mẫu với ảnh thật cho các product types hiện có
UPDATE product_types SET image_url = 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500' WHERE name = 'Mushroom';
UPDATE product_types SET image_url = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500' WHERE name = 'Vegetable';
UPDATE product_types SET image_url = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=500' WHERE name LIKE '%Bonsai%';

-- +goose Down
-- Xóa trường image_url khỏi bảng product_types
ALTER TABLE product_types DROP COLUMN IF EXISTS image_url;
