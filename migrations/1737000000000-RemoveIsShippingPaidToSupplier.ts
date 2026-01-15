import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Migration: Xóa cột is_shipping_paid_to_supplier khỏi bảng inventory_receipts
 * 
 * Lý do: Phí vận chuyển LUÔN LUÔN do người dùng tự chịu, không liên quan công nợ NCC.
 * Field này không còn cần thiết và tạo ra lỗ hổng bảo mật tiềm ẩn.
 * 
 * Tác động: Không ảnh hưởng dữ liệu cũ vì logic mới luôn trừ phí ship khỏi supplier_amount.
 */
export class RemoveIsShippingPaidToSupplier1737000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Kiểm tra xem cột có tồn tại không trước khi xóa
        const table = await queryRunner.getTable('inventory_receipts');
        const column = table?.findColumnByName('is_shipping_paid_to_supplier');
        
        if (column) {
            await queryRunner.dropColumn('inventory_receipts', 'is_shipping_paid_to_supplier');
            console.log('✅ Đã xóa cột is_shipping_paid_to_supplier khỏi bảng inventory_receipts');
        } else {
            console.log('⚠️ Cột is_shipping_paid_to_supplier không tồn tại, bỏ qua');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback: Tạo lại cột nếu cần
        await queryRunner.addColumn(
            'inventory_receipts',
            new TableColumn({
                name: 'is_shipping_paid_to_supplier',
                type: 'boolean',
                default: true,
                comment: 'Phí vận chuyển có trả cho nhà cung cấp không? (Deprecated - không còn sử dụng)'
            })
        );
        console.log('⚠️ Đã rollback: Tạo lại cột is_shipping_paid_to_supplier');
    }
}
