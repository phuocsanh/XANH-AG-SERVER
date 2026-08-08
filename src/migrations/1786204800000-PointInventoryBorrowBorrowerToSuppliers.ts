import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class PointInventoryBorrowBorrowerToSuppliers1786204800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('inventory_borrows');
    const oldForeignKey = table?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.includes('borrower_customer_id'),
    );

    if (oldForeignKey) {
      await queryRunner.dropForeignKey('inventory_borrows', oldForeignKey);
    }

    await queryRunner.createForeignKey(
      'inventory_borrows',
      new TableForeignKey({
        columnNames: ['borrower_customer_id'],
        referencedTableName: 'suppliers',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('inventory_borrows');
    const oldForeignKey = table?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.includes('borrower_customer_id'),
    );

    if (oldForeignKey) {
      await queryRunner.dropForeignKey('inventory_borrows', oldForeignKey);
    }

    await queryRunner.createForeignKey(
      'inventory_borrows',
      new TableForeignKey({
        columnNames: ['borrower_customer_id'],
        referencedTableName: 'customers',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }
}
