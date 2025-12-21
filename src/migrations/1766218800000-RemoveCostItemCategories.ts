import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveCostItemCategories1766218800000 implements MigrationInterface {
    name = 'RemoveCostItemCategories1766218800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Xóa khóa ngoại trong bảng cost_items trước
        const table = await queryRunner.getTable("cost_items");
        const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.indexOf("category_id") !== -1);
        if (foreignKey) {
            await queryRunner.dropForeignKey("cost_items", foreignKey);
        }

        // 2. Xóa các cột category và category_id
        await queryRunner.dropColumn("cost_items", "category_id");
        await queryRunner.dropColumn("cost_items", "category");

        // 3. Xóa bảng cost_item_categories
        await queryRunner.dropTable("cost_item_categories");
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Logic rollback (ít khi dùng trong dev mode nhưng vẫn nên có)
    }
}
