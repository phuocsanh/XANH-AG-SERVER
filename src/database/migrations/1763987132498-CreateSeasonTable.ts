import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from "typeorm";

export class CreateSeasonTable1763987132498 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Tạo bảng seasons
        await queryRunner.createTable(new Table({
            name: 'seasons',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                    comment: 'Tên mùa vụ (VD: Đông Xuân 2024)'
                },
                {
                    name: 'code',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                    isUnique: true,
                    comment: 'Mã mùa vụ (VD: DX2024)'
                },
                {
                    name: 'year',
                    type: 'int',
                    isNullable: false,
                    comment: 'Năm của mùa vụ'
                },
                {
                    name: 'start_date',
                    type: 'date',
                    isNullable: true,
                    comment: 'Ngày bắt đầu mùa vụ'
                },
                {
                    name: 'end_date',
                    type: 'date',
                    isNullable: true,
                    comment: 'Ngày kết thúc mùa vụ'
                },
                {
                    name: 'description',
                    type: 'text',
                    isNullable: true,
                    comment: 'Mô tả về mùa vụ'
                },
                {
                    name: 'is_active',
                    type: 'boolean',
                    default: true,
                    isNullable: false,
                    comment: 'Trạng thái hoạt động'
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false
                },
                {
                    name: 'updated_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP',
                    isNullable: false
                }
            ]
        }), true);

        // Thêm cột season_id vào bảng sales_invoices
        await queryRunner.addColumn('sales_invoices', new TableColumn({
            name: 'season_id',
            type: 'int',
            isNullable: true,
            comment: 'ID mùa vụ'
        }));

        // Tạo foreign key từ sales_invoices.season_id → seasons.id
        await queryRunner.createForeignKey('sales_invoices', new TableForeignKey({
            columnNames: ['season_id'],
            referencedTableName: 'seasons',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        }));

        // Insert một số mùa vụ mẫu
        await queryRunner.query(`
            INSERT INTO seasons (name, code, year, start_date, end_date, description, is_active) VALUES
            ('Đông Xuân 2024', 'DX2024', 2024, '2024-01-01', '2024-05-31', 'Mùa vụ Đông Xuân năm 2024', true),
            ('Hè Thu 2024', 'HT2024', 2024, '2024-06-01', '2024-10-31', 'Mùa vụ Hè Thu năm 2024', true),
            ('Mùa 2024-2025', 'M2024-2025', 2024, '2024-11-01', '2025-04-30', 'Mùa vụ 2024-2025', true)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa foreign key
        const table = await queryRunner.getTable('sales_invoices');
        const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.indexOf('season_id') !== -1);
        if (foreignKey) {
            await queryRunner.dropForeignKey('sales_invoices', foreignKey);
        }

        // Xóa cột season_id
        await queryRunner.dropColumn('sales_invoices', 'season_id');

        // Xóa bảng seasons
        await queryRunner.dropTable('seasons');
    }

}
