import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateRiceCropsTable1733149200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tạo bảng rice_crops
    await queryRunner.createTable(
      new Table({
        name: 'rice_crops',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'customer_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'season_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'field_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'field_area',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'location',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'rice_variety',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'seed_source',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'sowing_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'transplanting_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'expected_harvest_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'actual_harvest_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'growth_stage',
            type: 'varchar',
            length: '50',
            default: "'seedling'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'yield_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'quality_grade',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Tạo foreign key với bảng customers
    await queryRunner.createForeignKey(
      'rice_crops',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
        name: 'fk_rice_crops_customer',
      }),
    );

    // Tạo foreign key với bảng seasons
    await queryRunner.createForeignKey(
      'rice_crops',
      new TableForeignKey({
        columnNames: ['season_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'seasons',
        onDelete: 'CASCADE',
        name: 'fk_rice_crops_season',
      }),
    );

    // Tạo index cho các cột thường xuyên query
    await queryRunner.query(`
      CREATE INDEX idx_rice_crops_customer_id ON rice_crops(customer_id);
      CREATE INDEX idx_rice_crops_season_id ON rice_crops(season_id);
      CREATE INDEX idx_rice_crops_status ON rice_crops(status);
      CREATE INDEX idx_rice_crops_growth_stage ON rice_crops(growth_stage);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa các index
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_rice_crops_growth_stage;
      DROP INDEX IF EXISTS idx_rice_crops_status;
      DROP INDEX IF EXISTS idx_rice_crops_season_id;
      DROP INDEX IF EXISTS idx_rice_crops_customer_id;
    `);

    // Xóa foreign keys
    await queryRunner.dropForeignKey('rice_crops', 'fk_rice_crops_season');
    await queryRunner.dropForeignKey('rice_crops', 'fk_rice_crops_customer');

    // Xóa bảng
    await queryRunner.dropTable('rice_crops');
  }
}
