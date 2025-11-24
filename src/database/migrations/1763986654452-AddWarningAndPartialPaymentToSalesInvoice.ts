import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddWarningAndPartialPaymentToSalesInvoice1763986654452 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm cột warning (lưu ý)
        await queryRunner.addColumn('sales_invoices', new TableColumn({
            name: 'warning',
            type: 'text',
            isNullable: true,
            comment: 'Lưu ý quan trọng về hóa đơn'
        }));

        // Thêm cột partial_payment_amount (số tiền đã thanh toán)
        await queryRunner.addColumn('sales_invoices', new TableColumn({
            name: 'partial_payment_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
            isNullable: false,
            comment: 'Số tiền đã thanh toán (cho trường hợp bán thiếu)'
        }));

        // Thêm cột remaining_amount (số tiền còn nợ)
        await queryRunner.addColumn('sales_invoices', new TableColumn({
            name: 'remaining_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
            isNullable: false,
            comment: 'Số tiền còn nợ'
        }));

        // Cập nhật remaining_amount = final_amount cho các hóa đơn hiện có
        await queryRunner.query(`
            UPDATE sales_invoices 
            SET remaining_amount = final_amount 
            WHERE remaining_amount = 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa các cột đã thêm (rollback)
        await queryRunner.dropColumn('sales_invoices', 'remaining_amount');
        await queryRunner.dropColumn('sales_invoices', 'partial_payment_amount');
        await queryRunner.dropColumn('sales_invoices', 'warning');
    }

}
