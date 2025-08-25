-- name: GetProductSubtypeRelations :many
SELECT psr.*, ps.name as subtype_name, ps.description as subtype_description
FROM product_subtype_relations psr
JOIN product_subtypes ps ON psr.product_subtype_id = ps.id
WHERE psr.product_id = $1;

-- name: AddProductSubtypeRelation :exec
INSERT INTO product_subtype_relations (
    product_id,
    product_subtype_id
) VALUES (
    $1, $2
) ON CONFLICT (product_id, product_subtype_id) DO NOTHING;

-- name: RemoveProductSubtypeRelation :exec
DELETE FROM product_subtype_relations 
WHERE product_id = $1 AND product_subtype_id = $2;

-- name: RemoveAllProductSubtypeRelations :exec
DELETE FROM product_subtype_relations 
WHERE product_id = $1;
