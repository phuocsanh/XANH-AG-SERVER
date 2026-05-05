import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddReceiptItemIdToInventoryReturnItems1779400000000
  implements MigrationInterface
{
  name = 'AddReceiptItemIdToInventoryReturnItems1779400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'inventory_return_items',
      new TableColumn({
        name: 'receipt_item_id',
        type: 'integer',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'inventory_return_items',
      new TableForeignKey({
        columnNames: ['receipt_item_id'],
        referencedTableName: 'inventory_receipt_items',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.query(`
      UPDATE inventory_return_items iri
      SET receipt_item_id = matched.receipt_item_id
      FROM (
        SELECT
          iri2.id AS inventory_return_item_id,
          (
            SELECT rii.id
            FROM inventory_receipt_items rii
            WHERE rii.receipt_id = ir2.receipt_id
              AND rii.product_id = iri2.product_id
              AND (
                iri2.unit_id IS NULL
                OR rii.unit_id = iri2.unit_id
              )
            ORDER BY
              CASE
                WHEN ABS(COALESCE(rii.final_unit_cost, rii.unit_cost, 0) - COALESCE(iri2.unit_cost, 0)) < 0.000001 THEN 0
                ELSE 1
              END,
              rii.id ASC
            LIMIT 1
          ) AS receipt_item_id
        FROM inventory_return_items iri2
        JOIN inventory_returns ir2 ON ir2.id = iri2.return_id
        WHERE iri2.receipt_item_id IS NULL
          AND ir2.receipt_id IS NOT NULL
      ) matched
      WHERE iri.id = matched.inventory_return_item_id
        AND matched.receipt_item_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('inventory_return_items');
    const foreignKey = table?.foreignKeys.find((fk) =>
      fk.columnNames.includes('receipt_item_id'),
    );

    if (foreignKey) {
      await queryRunner.dropForeignKey('inventory_return_items', foreignKey);
    }

    await queryRunner.dropColumn('inventory_return_items', 'receipt_item_id');
  }
}
