-- name: CreateProduct :one
INSERT INTO products (
    product_name,
    product_price,
    product_status,
    product_thumb,
    product_pictures,
    product_videos,
    product_ratings_average,
    product_variations,
    product_description,
    product_slug,
    product_quantity,
    product_type,
    sub_product_type,
    discount,
    product_discounted_price,
    product_selled,
    product_attributes,
    is_draft,
    is_published,
    created_at,
    updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW()
) RETURNING *;

-- name: GetProduct :one
SELECT * FROM products WHERE id = $1;

-- name: CountProducts :one
SELECT COUNT(*) FROM products WHERE is_published = true;

-- name: ListProducts :many
SELECT * FROM products
WHERE is_published = true
ORDER BY created_at DESC
LIMIT CASE WHEN $1 = 0 THEN NULL ELSE $1 END
OFFSET $2;

-- name: ListProductsWithFilter :many
SELECT * FROM products
WHERE is_published = true
AND (
    CASE
        WHEN sqlc.narg('product_type')::integer IS NOT NULL THEN product_type = sqlc.narg('product_type')::integer
        ELSE true
    END
)
AND (
    CASE
        WHEN sqlc.narg('sub_product_type')::integer IS NOT NULL THEN sqlc.narg('sub_product_type')::integer = ANY(sub_product_type)
        ELSE true
    END
)
ORDER BY created_at DESC
LIMIT CASE WHEN sqlc.arg('limit') = 0 THEN NULL ELSE sqlc.arg('limit') END
OFFSET sqlc.arg('offset');

-- name: UpdateProduct :one
UPDATE products
SET
    product_name = $2,
    product_price = $3,
    product_status = $4,
    product_thumb = $5,
    product_pictures = $6,
    product_videos = $7,
    product_ratings_average = $8,
    product_variations = $9,
    product_description = $10,
    product_slug = $11,
    product_quantity = $12,
    product_type = $13,
    sub_product_type = $14,
    discount = $15,
    product_discounted_price = $16,
    product_selled = $17,
    product_attributes = $18,
    is_draft = $19,
    is_published = $20,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteProduct :exec
DELETE FROM products WHERE id = $1;

-- name: SearchProducts :many
SELECT * FROM products
WHERE is_published = true
AND (
    product_name ILIKE '%' || $1 || '%'
    OR product_description ILIKE '%' || $1 || '%'
)
ORDER BY created_at DESC
LIMIT $2
OFFSET $3;

-- name: FilterProducts :many
SELECT * FROM products
WHERE is_published = true
AND (
    CASE
        WHEN sqlc.narg('category')::integer IS NOT NULL THEN product_type = sqlc.narg('category')::integer
        ELSE true
    END
)
AND (
    CASE
        WHEN sqlc.narg('min_price')::text IS NOT NULL THEN product_price::numeric >= sqlc.narg('min_price')::numeric
        ELSE true
    END
)
AND (
    CASE
        WHEN sqlc.narg('max_price')::text IS NOT NULL THEN product_price::numeric <= sqlc.narg('max_price')::numeric
        ELSE true
    END
)
AND (
    CASE
        WHEN sqlc.narg('in_stock')::boolean IS NOT NULL THEN
            CASE
                WHEN sqlc.narg('in_stock')::boolean = true THEN product_quantity > 0
                ELSE product_quantity = 0
            END
        ELSE true
    END
)
ORDER BY
    CASE
        WHEN sqlc.narg('sort_by')::text = 'price' AND sqlc.narg('sort_order')::text = 'asc' THEN product_price
    END ASC,
    CASE
        WHEN sqlc.narg('sort_by')::text = 'price' AND sqlc.narg('sort_order')::text = 'desc' THEN product_price
    END DESC,
    CASE
        WHEN sqlc.narg('sort_by')::text = 'name' AND sqlc.narg('sort_order')::text = 'asc' THEN product_name
    END ASC,
    CASE
        WHEN sqlc.narg('sort_by')::text = 'name' AND sqlc.narg('sort_order')::text = 'desc' THEN product_name
    END DESC,
    CASE
        WHEN sqlc.narg('sort_by')::text = 'created_at' AND sqlc.narg('sort_order')::text = 'asc' THEN created_at
    END ASC,
    CASE
        WHEN sqlc.narg('sort_by')::text = 'created_at' AND sqlc.narg('sort_order')::text = 'desc' THEN created_at
    END DESC,
    CASE
        WHEN sqlc.narg('sort_by')::text IS NULL THEN created_at
    END DESC
LIMIT sqlc.arg('limit')
OFFSET sqlc.arg('offset');

-- name: GetProductStats :one
SELECT
    COUNT(*) as total_products,
    COUNT(CASE WHEN product_quantity > 0 THEN 1 END) as in_stock_products,
    COUNT(CASE WHEN product_quantity = 0 THEN 1 END) as out_of_stock_products,
    COALESCE(SUM(product_selled), 0) as total_products_sold,
    COALESCE(AVG(product_ratings_average::numeric), 0) as average_rating,
    COALESCE(MIN(product_price::numeric), 0) as min_price,
    COALESCE(MAX(product_price::numeric), 0) as max_price,
    COALESCE(AVG(product_price::numeric), 0) as avg_price,
    COUNT(DISTINCT product_type) as total_categories
FROM products
WHERE is_published = true;