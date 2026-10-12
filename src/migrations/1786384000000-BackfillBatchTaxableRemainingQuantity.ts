import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initializes the per-batch taxable balance for legacy inventory rows.
 * The product-level taxable balance is reconciled separately.
 */
export class BackfillBatchTaxableRemainingQuantity1786384000000
  implements MigrationInterface
{
  name = 'BackfillBatchTaxableRemainingQuantity1786384000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH backfill AS (
        SELECT inventory.id,
          CASE
            WHEN customer_return_tax.taxable_initial IS NOT NULL THEN GREATEST(
              0,
              LEAST(
                GREATEST(COALESCE(inventory."remaining_quantity", 0), 0),
                GREATEST(
                  customer_return_tax.taxable_initial
                    - GREATEST(
                      GREATEST(COALESCE(inventory."original_quantity", 0), 0)
                        - GREATEST(COALESCE(inventory."remaining_quantity", 0), 0),
                      0
                    ),
                  0
                )
              )
            )
            WHEN inventory."code" LIKE 'RETURN-%' THEN 0
            WHEN receipt_item.id IS NULL THEN 0
            ELSE GREATEST(
              0,
              LEAST(
                GREATEST(COALESCE(inventory."remaining_quantity", 0), 0),
                GREATEST(
                  LEAST(
                    GREATEST(COALESCE(receipt_item."taxable_quantity", 0), 0)
                      * CASE
                          WHEN COALESCE(receipt_item."conversion_factor", 1) > 0
                            THEN COALESCE(receipt_item."conversion_factor", 1)
                          ELSE 1
                        END,
                    GREATEST(COALESCE(inventory."original_quantity", 0), 0)
                  )
                    - GREATEST(
                      GREATEST(COALESCE(inventory."original_quantity", 0), 0)
                        - GREATEST(COALESCE(inventory."remaining_quantity", 0), 0),
                      0
                    ),
                  0
                )
              )
            )
          END AS taxable_remaining_quantity
        FROM "inventories" AS inventory
        LEFT JOIN "inventory_receipt_items" AS receipt_item
          ON inventory."receipt_item_id" = receipt_item.id
        LEFT JOIN LATERAL (
          SELECT LEAST(
            GREATEST(COALESCE(inventory."original_quantity", 0), 0),
            GREATEST(SUM(NULLIF(allocation->>'taxableQuantity', '')::numeric), 0)
          ) AS taxable_initial
          FROM "sales_return_items" AS sales_return_item
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(COALESCE(sales_return_item."stock_allocations"::jsonb, '[]'::jsonb)) = 'array'
                THEN COALESCE(sales_return_item."stock_allocations"::jsonb, '[]'::jsonb)
              ELSE '[]'::jsonb
            END
          ) AS allocation
          WHERE NULLIF(allocation->>'batchId', '')::bigint = inventory."id"
        ) AS customer_return_tax ON TRUE
        WHERE inventory."deleted_at" IS NULL
          AND inventory."taxable_remaining_quantity" IS NULL
      )
      UPDATE "inventories" AS inventory
      SET "taxable_remaining_quantity" = backfill.taxable_remaining_quantity
      FROM backfill
      WHERE inventory.id = backfill.id
    `);

    await queryRunner.query(`
      UPDATE "inventories"
      SET "taxable_remaining_quantity" = 0
      WHERE "deleted_at" IS NULL
        AND "taxable_remaining_quantity" IS NULL
    `);
  }

  // This is a state initialization; clearing it on rollback could erase later stock movements.
  public async down(): Promise<void> {}
}
