-- name: GetProductSubtype :one
SELECT * FROM product_subtypes WHERE id = $1;

-- name: ListProductSubtypes :many
SELECT * FROM product_subtypes ORDER BY id;

-- name: ListProductSubtypesByType :many
SELECT ps.* FROM product_subtypes ps
JOIN product_subtype_mappings psm ON ps.id = psm.product_subtype_id
WHERE psm.product_type_id = $1
ORDER BY ps.id;

-- name: CreateProductSubtype :one
INSERT INTO product_subtypes (
    name,
    description
) VALUES (
    $1, $2
) RETURNING *;

-- name: UpdateProductSubtype :one
UPDATE product_subtypes
SET 
    name = $2,
    description = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteProductSubtype :exec
DELETE FROM product_subtypes WHERE id = $1;

-- name: AddProductSubtypeMapping :exec
INSERT INTO product_subtype_mappings (
    product_type_id,
    product_subtype_id
) VALUES (
    $1, $2
) ON CONFLICT (product_type_id, product_subtype_id) DO NOTHING;

-- name: RemoveProductSubtypeMapping :exec
DELETE FROM product_subtype_mappings 
WHERE product_type_id = $1 AND product_subtype_id = $2;
