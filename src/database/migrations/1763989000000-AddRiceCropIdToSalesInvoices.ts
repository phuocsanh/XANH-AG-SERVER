import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class AddRiceCropIdToSalesInvoices1763989000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Kiểm tra và thêm cột rice_crop_id vào bảng sales_invoices nếu chưa tồn tại
        const table = await queryRunner.getTable('sales_invoices');
        if (table && !table.findColumnByName('rice_crop_id')) {
            await queryRunner.addColumn('sales_invoices', new TableColumn({
                name: 'rice_crop_id',
                type: 'int',
                isNullable: true,
                comment: 'ID mảnh ruộng (để biết chi phí cho ruộng nào)'
            }));

            // Tạo foreign key từ sales_invoices.rice_crop_id → rice_crops.id
            await queryRunner.createForeignKey('sales_invoices', new TableForeignKey({
                columnNames: ['rice_crop_id'],
                referencedTableName: 'rice_crops',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE'
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('sales_invoices');
        const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.indexOf('rice_crop_id') !== -1);
        if (foreignKey) {
            await queryRunner.dropForeignKey('sales_invoices', foreignKey);
        }

        await queryRunner.dropColumn('sales_invoices', 'rice_crop_id');
    }

}
