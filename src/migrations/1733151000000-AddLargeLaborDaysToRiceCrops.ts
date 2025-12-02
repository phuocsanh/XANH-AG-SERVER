import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLargeLaborDaysToRiceCrops1733151000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'rice_crops',
      new TableColumn({
        name: 'large_labor_days',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: false,
        default: 0,
        comment: 'Số công lớn (diện tích tính theo công)',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('rice_crops', 'large_labor_days');
  }
}
