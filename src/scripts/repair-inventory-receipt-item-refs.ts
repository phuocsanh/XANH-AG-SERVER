import { AppDataSource } from '../config/data-source';

type OrphanInventoryReceiptItemRef = {
  id: number;
  product_id: number;
  code: string | null;
  receipt_item_id: number;
};

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');

async function main() {
  await AppDataSource.initialize();

  try {
    const orphanRows = (await AppDataSource.query(`
      SELECT
        b.id,
        b.product_id,
        b.code,
        b.receipt_item_id
      FROM inventories b
      LEFT JOIN inventory_receipt_items iri
        ON iri.id = b.receipt_item_id
      WHERE b.receipt_item_id IS NOT NULL
        AND iri.id IS NULL
      ORDER BY b.id ASC
    `)) as OrphanInventoryReceiptItemRef[];

    if (orphanRows.length === 0) {
      console.log('No orphan inventories.receipt_item_id values found.');
      return;
    }

    console.table(
      orphanRows.map((row) => ({
        inventory_id: row.id,
        product_id: row.product_id,
        code: row.code,
        missing_receipt_item_id: row.receipt_item_id,
      })),
    );

    if (!shouldApply) {
      console.log(
        `Found ${orphanRows.length} orphan inventories.receipt_item_id value(s). Re-run with --apply to set them to NULL.`,
      );
      return;
    }

    await AppDataSource.transaction(async (manager) => {
      const result = await manager.query(`
        UPDATE inventories b
        SET receipt_item_id = NULL,
            updated_at = NOW()
        WHERE b.receipt_item_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM inventory_receipt_items iri
            WHERE iri.id = b.receipt_item_id
          )
      `);

      const updatedCount = Array.isArray(result) ? result[1] : undefined;
      console.log(
        `Updated ${updatedCount ?? orphanRows.length} inventories row(s): invalid receipt_item_id values were set to NULL.`,
      );
    });
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch(async (error) => {
  console.error('Failed to repair inventories.receipt_item_id references.');
  console.error(error);

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  process.exit(1);
});
