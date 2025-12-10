import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from "typeorm";

export class CreateCostItemCategory1733846400000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Tạo bảng cost_item_categories
        await queryRunner.createTable(
            new Table({
                name: 'cost_item_categories',
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

        // 2. Seed 7 loại mặc định từ enum
        const defaultCategories = [
            { code: 'seed', name: 'Giống' },
            { code: 'fertilizer', name: 'Phân bón' },
            { code: 'pesticide', name: 'Thuốc BVTV' },
            { code: 'labor', name: 'Công lao động' },
            { code: 'machinery', name: 'Máy móc' },
            { code: 'irrigation', name: 'Tưới tiêu' },
            { code: 'other', name: 'Khác' },
        ];

        for (const category of defaultCategories) {
            await queryRunner.query(
                `INSERT INTO cost_item_categories (code, name, is_active) VALUES ($1, $2, $3)`,
                [category.code, category.name, true],
            );
        }

        // 3. Thêm cột category_id vào cost_items (nullable tạm thời)
        await queryRunner.addColumn(
            'cost_items',
            new TableColumn({
                name: 'category_id',
                type: 'int',
                isNullable: true,
            }),
        );

        // 4. Migrate dữ liệu: Map enum category -> category_id
        const items = await queryRunner.query(
            `SELECT id, category FROM cost_items WHERE category IS NOT NULL`,
        );

        for (const item of items) {
            // Tìm category có code khớp với enum value
            const category = await queryRunner.query(
                `SELECT id FROM cost_item_categories WHERE code = $1 LIMIT 1`,
                [item.category],
            );

            if (category && category.length > 0) {
                await queryRunner.query(
                    `UPDATE cost_items SET category_id = $1 WHERE id = $2`,
                    [category[0].id, item.id],
                );
            }
        }

        // 5. Đổi category enum thành nullable (deprecated)
        // PostgreSQL không cho phép ALTER COLUMN enum trực tiếp, nên ta drop constraint
        await queryRunner.query(`ALTER TABLE cost_items ALTER COLUMN category DROP NOT NULL`);

        // 6. Tạo Foreign Key
        await queryRunner.createForeignKey(
            'cost_items',
            new TableForeignKey({
                columnNames: ['category_id'],
                referencedTableName: 'cost_item_categories',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert changes
        const table = await queryRunner.getTable('cost_items');
        const foreignKey = table?.foreignKeys.find(
            (fk) => fk.columnNames.indexOf('category_id') !== -1,
        );

        if (foreignKey) {
            await queryRunner.dropForeignKey('cost_items', foreignKey);
        }

        await queryRunner.dropColumn('cost_items', 'category_id');

        // Restore category column to NOT NULL
        await queryRunner.query(`ALTER TABLE cost_items ALTER COLUMN category SET NOT NULL`);

        await queryRunner.dropTable('cost_item_categories');
    }
}
