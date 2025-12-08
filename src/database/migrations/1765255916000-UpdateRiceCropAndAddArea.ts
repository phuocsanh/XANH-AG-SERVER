import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from "typeorm";

export class UpdateRiceCropAndAddArea1765255916000 implements MigrationInterface {
    name = 'UpdateRiceCropAndAddArea1765255916000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create area_of_each_plot_of_land table
        await queryRunner.createTable(new Table({
            name: "area_of_each_plot_of_land",
            columns: [
                {
                    name: "id",
                    type: "int",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "increment",
                },
                {
                    name: "name",
                    type: "varchar",
                    length: "255",
                },
                {
                    name: "code",
                    type: "varchar",
                    length: "50",
                    isUnique: true,
                },
                {
                    name: "acreage",
                    type: "decimal",
                    precision: 10,
                    scale: 2,
                },
                {
                    name: "created_at",
                    type: "timestamp",
                    default: "now()",
                },
                {
                    name: "updated_at",
                    type: "timestamp",
                    default: "now()",
                },
            ],
        }), true);

        // 2. Rename large_labor_days to amount_of_land
        await queryRunner.renameColumn("rice_crops", "large_labor_days", "amount_of_land");

        // 3. Add area_of_each_plot_of_land_id column
        await queryRunner.addColumn("rice_crops", new TableColumn({
            name: "area_of_each_plot_of_land_id",
            type: "int",
            isNullable: true,
        }));

        // 4. Add Foreign Key
        await queryRunner.createForeignKey("rice_crops", new TableForeignKey({
            columnNames: ["area_of_each_plot_of_land_id"],
            referencedColumnNames: ["id"],
            referencedTableName: "area_of_each_plot_of_land",
            onDelete: "SET NULL", // Or defined behavior
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert steps
        const table = await queryRunner.getTable("rice_crops");
        const foreignKey = table!.foreignKeys.find(fk => fk.columnNames.indexOf("area_of_each_plot_of_land_id") !== -1);
        await queryRunner.dropForeignKey("rice_crops", foreignKey!);
        await queryRunner.dropColumn("rice_crops", "area_of_each_plot_of_land_id");
        await queryRunner.renameColumn("rice_crops", "amount_of_land", "large_labor_days");
        await queryRunner.dropTable("area_of_each_plot_of_land");
    }
}
