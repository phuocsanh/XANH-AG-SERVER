-- +goose Up
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(150) NOT NULL,
    product_price DECIMAL NOT NULL,
    product_status INTEGER DEFAULT 1,
    product_thumb TEXT NOT NULL,
    product_pictures TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    product_videos TEXT[] DEFAULT ARRAY[]::TEXT[],
    product_ratings_average DECIMAL DEFAULT 4.5,
    product_variations JSONB DEFAULT '[]'::JSONB,
    product_description TEXT,
    product_slug TEXT,
    product_quantity INTEGER,
    product_type INTEGER NOT NULL,
    sub_product_type INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    discount DECIMAL DEFAULT 0,
    product_discounted_price DECIMAL NOT NULL,
    product_selled INTEGER DEFAULT 0,
    product_attributes JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_draft BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_published_type ON products(is_published, product_type);
CREATE INDEX IF NOT EXISTS idx_products_name_desc ON products USING gin(to_tsvector('english', product_name || ' ' || product_description));

-- +goose Down
DROP TABLE IF EXISTS products; 