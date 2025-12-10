import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from "typeorm";

export class CreateOperatingCostCategory1733842800000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Tạo bảng operating_cost_categories
        await queryRunner.createTable(
            new Table({
                name: 'operating_cost_categories',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'code',
                        type: 'varchar',
                        length: '50',
                        isUnique: true,
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '255',
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'is_active',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'now()',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'now()',
                    },
                ],
            }),
            true,
        );

        // 2. Seed 12 loại mặc định
        const defaultCategories = [
            { code: 'labor', name: 'Nhân công' },
            { code: 'harvesting', name: 'Thu hoạch' },
            { code: 'electricity', name: 'Điện' },
            { code: 'water', name: 'Nước' },
            { code: 'rent', name: 'Thuê đất/mặt bằng' },
            { code: 'marketing', name: 'Marketing' },
            { code: 'packaging', name: 'Bao bì' },
            { code: 'fuel', name: 'Nhiên liệu' },
            { code: 'maintenance', name: 'Bảo trì' },
            { code: 'interest', name: 'Lãi vay' },
            { code: 'tax', name: 'Thuế' },
            { code: 'other', name: 'Khác' },
        ];

        for (const category of defaultCategories) {
            await queryRunner.query(
                `INSERT INTO operating_cost_categories (code, name, is_active) VALUES ($1, $2, $3)`,
                [category.code, category.name, true],
            );
        }

        // 3. Thêm cột category_id vào operating_costs (nullable tạm thời)
        await queryRunner.addColumn(
            'operating_costs',
            new TableColumn({
                name: 'category_id',
                type: 'int',
                isNullable: true,
            }),
        );

        // 4. Migrate dữ liệu: Map type string -> category_id
        // Lấy tất cả operating costs có type
        const costs = await queryRunner.query(
            `SELECT id, type FROM operating_costs WHERE type IS NOT NULL`,
        );

        for (const cost of costs) {
            // Tìm category có code khớp với type
            const category = await queryRunner.query(
                `SELECT id FROM operating_cost_categories WHERE code = $1 LIMIT 1`,
                [cost.type],
            );

            if (category && category.length > 0) {
                // Nếu tìm thấy, update category_id
                await queryRunner.query(
                    `UPDATE operating_costs SET category_id = $1 WHERE id = $2`,
                    [category[0].id, cost.id],
                );
            } else {
                // Nếu không tìm thấy (custom type), tạo category mới
                const result = await queryRunner.query(
                    `INSERT INTO operating_cost_categories (code, name, is_active) VALUES ($1, $2, $3) RETURNING id`,
                    [cost.type, cost.type, true],
                );
                
                await queryRunner.query(
                    `UPDATE operating_costs SET category_id = $1 WHERE id = $2`,
                    [result[0].id, cost.id],
                );
            }
        }

        // 5. Đổi type thành nullable (để backward compatible tạm thời)
        await queryRunner.changeColumn(
            'operating_costs',
            'type',
            new TableColumn({
                name: 'type',
                type: 'varchar',
                isNullable: true,
            }),
        );

        // 6. Tạo Foreign Key
        await queryRunner.createForeignKey(
            'operating_costs',
            new TableForeignKey({
                columnNames: ['category_id'],
                referencedTableName: 'operating_cost_categories',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert changes
        const table = await queryRunner.getTable('operating_costs');
        const foreignKey = table?.foreignKeys.find(
            (fk) => fk.columnNames.indexOf('category_id') !== -1,
        );

        if (foreignKey) {
            await queryRunner.dropForeignKey('operating_costs', foreignKey);
        }

        await queryRunner.dropColumn('operating_costs', 'category_id');

        // Restore type column to NOT NULL
        await queryRunner.changeColumn(
            'operating_costs',
            'type',
            new TableColumn({
                name: 'type',
                type: 'varchar',
                isNullable: false,
            }),
        );

        await queryRunner.dropTable('operating_cost_categories');
    }
}
