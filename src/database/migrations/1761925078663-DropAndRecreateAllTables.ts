import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAndRecreateAllTables1761925078663
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Disable foreign key checks
    await queryRunner.query(`SET CONSTRAINTS ALL DEFERRED;`);

    // Drop all tables
    await queryRunner.query(`DROP TABLE IF EXISTS "user_profiles" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "units" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_types" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_subtypes" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products" CASCADE;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "inventory_receipts" CASCADE;`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "inventory_receipt_items" CASCADE;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "inventories" CASCADE;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "inventory_transactions" CASCADE;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_invoices" CASCADE;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "sales_invoice_items" CASCADE;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "file_uploads" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_references" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rice_market_data" CASCADE;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "weather_forecasts" CASCADE;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "symbols" CASCADE;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "product_subtype_relations" CASCADE;`,
    );

    // Re-enable foreign key checks
    await queryRunner.query(`SET CONSTRAINTS ALL IMMEDIATE;`);

    // Note: TypeORM will automatically recreate tables based on entity definitions
    // when synchronize is enabled or when running subsequent migrations
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This is a destructive operation, so down migration is not implemented
    // In a real scenario, you would restore from backups
    console.log('Down migration not implemented for destructive operation');
    // Using queryRunner to avoid TypeScript error
    await queryRunner.query(`SELECT 1;`);
  }
}
