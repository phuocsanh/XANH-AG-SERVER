import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class UpdateOperatingCost1765255917000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Rename columns if needed (createdAt -> created_at, updatedAt -> updated_at)
        const table = await queryRunner.getTable('operating_costs');
        if (table) {
            const createdAtCol = table.findColumnByName('createdAt');
            if (createdAtCol) {
                await queryRunner.renameColumn('operating_costs', 'createdAt', 'created_at');
            } else if (!table.findColumnByName('created_at')) {
                 // Nếu chưa có cả 2, tạo mới created_at (hiếm khi xảy ra nếu entity đã sync)
            }
            
            const updatedAtCol = table.findColumnByName('updatedAt');
            if (updatedAtCol) {
                await queryRunner.renameColumn('operating_costs', 'updatedAt', 'updated_at');
            }
        }

        // 2. Add season_id
        if (table && !table.findColumnByName('season_id')) {
            await queryRunner.addColumn('operating_costs', new TableColumn({
                name: 'season_id',
                type: 'int',
                isNullable: true,
            }));
            
            await queryRunner.createForeignKey('operating_costs', new TableForeignKey({
                columnNames: ['season_id'],
                referencedTableName: 'seasons',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }));
        }

        // 3. Add rice_crop_id
        if (table && !table.findColumnByName('rice_crop_id')) {
             await queryRunner.addColumn('operating_costs', new TableColumn({
                name: 'rice_crop_id',
                type: 'int',
                isNullable: true,
            }));

            await queryRunner.createForeignKey('operating_costs', new TableForeignKey({
                columnNames: ['rice_crop_id'],
                referencedTableName: 'rice_crops',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }));
        }

        // 4. Add expense_date
        if (table && !table.findColumnByName('expense_date')) {
            await queryRunner.addColumn('operating_costs', new TableColumn({
                name: 'expense_date',
                type: 'timestamp',
                default: 'now()',
                isNullable: true,
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
         const table = await queryRunner.getTable('operating_costs');
         
         if (table) {
            // Drop expense_date
            if (table.findColumnByName('expense_date')) {
                 await queryRunner.dropColumn('operating_costs', 'expense_date');
            }
            
            // Drop FKs and Columns
            const seasonIdCol = table.findColumnByName('season_id');
            if (seasonIdCol) {
                const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('season_id') !== -1);
                if (foreignKey) await queryRunner.dropForeignKey('operating_costs', foreignKey);
                await queryRunner.dropColumn('operating_costs', 'season_id');
            }

            const riceCropIdCol = table.findColumnByName('rice_crop_id');
            if (riceCropIdCol) {
                const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('rice_crop_id') !== -1);
                if (foreignKey) await queryRunner.dropForeignKey('operating_costs', foreignKey);
                await queryRunner.dropColumn('operating_costs', 'rice_crop_id');
            }
            
            // Revert renames (Optional, assume we want to keep snake_case)
         }
    }
}
