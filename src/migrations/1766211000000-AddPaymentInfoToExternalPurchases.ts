import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaymentInfoToExternalPurchases1766211000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('external_purchases', [
      new TableColumn({
        name: 'paid_amount',
        type: 'decimal',
        precision: 15,
        scale: 2,
        default: 0,
      }),
      new TableColumn({
        name: 'payment_status',
        type: 'varchar',
        length: '50',
        default: "'pending'",
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('external_purchases', 'payment_status');
    await queryRunner.dropColumn('external_purchases', 'paid_amount');
  }
}
