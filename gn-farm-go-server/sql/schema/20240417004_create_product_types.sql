-- +goose Up
-- Tạo bảng product_types để lưu trữ các loại sản phẩm chính
CREATE TABLE IF NOT EXISTS product_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tạo bảng product_subtypes để lưu trữ các loại sản phẩm phụ
CREATE TABLE IF NOT EXISTS product_subtypes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tạo bảng trung gian để thiết lập quan hệ nhiều-nhiều giữa product_types và product_subtypes
CREATE TABLE IF NOT EXISTS product_subtype_mappings (
    product_type_id INTEGER NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
    product_subtype_id INTEGER NOT NULL REFERENCES product_subtypes(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_type_id, product_subtype_id)
);

-- Tạo bảng trung gian để lưu trữ quan hệ nhiều-nhiều giữa products và product_subtypes
CREATE TABLE IF NOT EXISTS product_subtype_relations (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_subtype_id INTEGER NOT NULL REFERENCES product_subtypes(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, product_subtype_id)
);

-- Thêm khóa ngoại vào bảng products để tham chiếu đến product_types
-- Đảm bảo tất cả các giá trị product_type hiện có đều hợp lệ trước khi thêm khóa ngoại
UPDATE products SET product_type = 1 WHERE product_type NOT IN (1, 2, 3);
ALTER TABLE products ADD CONSTRAINT fk_product_type FOREIGN KEY (product_type) REFERENCES product_types(id);

-- Chuyển dữ liệu từ trường sub_product_type trong bảng products sang bảng product_subtype_relations
INSERT INTO product_subtype_relations (product_id, product_subtype_id)
SELECT p.id, unnest(p.sub_product_type)
FROM products p
WHERE p.sub_product_type IS NOT NULL AND array_length(p.sub_product_type, 1) > 0
ON CONFLICT (product_id, product_subtype_id) DO NOTHING;

-- Thêm dữ liệu mẫu cho bảng product_types
INSERT INTO product_types (id, name, description) VALUES
(1, 'Mushroom', 'Various types of mushrooms'),
(2, 'Vegetable', 'Fresh vegetables'),
(3, 'Bonsai', 'Decorative bonsai plants')
ON CONFLICT (id) DO NOTHING;

-- Thêm dữ liệu mẫu cho bảng product_subtypes
INSERT INTO product_subtypes (id, name, description) VALUES
(1, 'Shiitake', 'Shiitake mushrooms'),
(2, 'Button', 'Button mushrooms'),
(3, 'Oyster', 'Oyster mushrooms'),
(4, 'Leafy Greens', 'Leafy green vegetables'),
(5, 'Root Vegetables', 'Root vegetables'),
(6, 'Fruit Vegetables', 'Fruit-bearing vegetables'),
(7, 'Indoor Bonsai', 'Bonsai for indoor decoration'),
(8, 'Outdoor Bonsai', 'Bonsai for outdoor decoration'),
(9, 'Flowering Bonsai', 'Flowering bonsai plants')
ON CONFLICT (id) DO NOTHING;

-- Thiết lập quan hệ giữa product_types và product_subtypes
INSERT INTO product_subtype_mappings (product_type_id, product_subtype_id) VALUES
(1, 1), (1, 2), (1, 3),  -- Mushroom subtypes
(2, 4), (2, 5), (2, 6),  -- Vegetable subtypes
(3, 7), (3, 8), (3, 9)   -- Bonsai subtypes
ON CONFLICT (product_type_id, product_subtype_id) DO NOTHING;

-- +goose Down
-- Xóa khóa ngoại từ bảng products
ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_product_type;

-- Chuyển dữ liệu từ bảng product_subtype_relations sang trường sub_product_type trong bảng products
UPDATE products p SET sub_product_type = (
    SELECT ARRAY_AGG(psr.product_subtype_id)
    FROM product_subtype_relations psr
    WHERE psr.product_id = p.id
);

-- Xóa các bảng theo thứ tự ngược lại
DROP TABLE IF EXISTS product_subtype_relations;
DROP TABLE IF EXISTS product_subtype_mappings;
DROP TABLE IF EXISTS product_subtypes;
DROP TABLE IF EXISTS product_types;
