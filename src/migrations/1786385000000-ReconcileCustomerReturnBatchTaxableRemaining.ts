import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reconciles return batches after the initial backfill. Return batches can
 * already have sales, so their current taxable balance is not the original
 * taxable snapshot.
 */
export class ReconcileCustomerReturnBatchTaxableRemaining1786385000000
  implements MigrationInterface
{
  name = 'ReconcileCustomerReturnBatchTaxableRemaining1786385000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH return_tax AS (
        SELECT inventory.id,
          inventory.original_quantity,
          inventory.remaining_quantity,
          customer_return_tax.taxable_initial
        FROM "inventories" AS inventory
        CROSS JOIN LATERAL (
          SELECT CASE
            WHEN COUNT(*) > 0
              AND COUNT(*) FILTER (WHERE allocation ? 'taxableQuantity') = COUNT(*)
            THEN LEAST(
              GREATEST(COALESCE(inventory."original_quantity", 0), 0),
              GREATEST(SUM(NULLIF(allocation->>'taxableQuantity', '')::numeric), 0)
            )
            ELSE NULL
          END AS taxable_initial
          FROM "sales_return_items" AS sales_return_item
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(COALESCE(sales_return_item."stock_allocations"::jsonb, '[]'::jsonb)) = 'array'
                THEN COALESCE(sales_return_item."stock_allocations"::jsonb, '[]'::jsonb)
              ELSE '[]'::jsonb
            END
          ) AS allocation
          WHERE NULLIF(allocation->>'batchId', '')::bigint = inventory."id"
        ) AS customer_return_tax
        WHERE inventory."code" LIKE 'RETURN-%'
          AND inventory."deleted_at" IS NULL
          AND customer_return_tax.taxable_initial IS NOT NULL
      )
      UPDATE "inventories" AS inventory
      SET "taxable_remaining_quantity" = GREATEST(
        0,
        LEAST(
          GREATEST(COALESCE(inventory."remaining_quantity", 0), 0),
          GREATEST(
            GREATEST(COALESCE(inventory."remaining_quantity", 0), 0)
              - GREATEST(
                GREATEST(COALESCE(inventory."original_quantity", 0), 0)
                  - return_tax.taxable_initial
                  - GREATEST(
                    GREATEST(COALESCE(inventory."original_quantity", 0), 0)
                      - GREATEST(COALESCE(inventory."remaining_quantity", 0), 0),
                    0
                  ),
                0
              )
          )
        )
      )
      FROM return_tax
      WHERE inventory.id = return_tax.id
    `);
  }

  public async down(): Promise<void> {}
}
