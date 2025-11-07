import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProfitMarginPercentToProducts1762520319207
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Kiểm tra xem cột profit_margin_percent đã tồn tại chưa
    const hasColumn = await queryRunner.hasColumn(
      'products',
      'profit_margin_percent',
    );

    // Nếu cột chưa tồn tại thì thêm vào
    if (!hasColumn) {
      await queryRunner.addColumn(
        'products',
        new TableColumn({
          name: 'profit_margin_percent',
          type: 'decimal',
          precision: 5,
          scale: 2,
          default: '15.00',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa cột profit_margin_percent nếu tồn tại
    const hasColumn = await queryRunner.hasColumn(
      'products',
      'profit_margin_percent',
    );

    if (hasColumn) {
      await queryRunner.dropColumn('products', 'profit_margin_percent');
    }
  }
}
