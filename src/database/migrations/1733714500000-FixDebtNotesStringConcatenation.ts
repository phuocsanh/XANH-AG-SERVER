import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration để fix bug debt_notes bị nối chuỗi
 * 
 * Chiến lược: XÓA và TẠO LẠI debt_notes từ invoices
 * 
 * ⚠️ LƯU Ý: Migration này sẽ XÓA TẤT CẢ debt_notes hiện có!
 * Chỉ chạy nếu:
 * 1. Chưa có payment nào
 * 2. Hoặc đã backup database
 */
export class FixDebtNotesStringConcatenation1733714500000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔧 Bắt đầu fix debt_notes...');

        // 1. Kiểm tra xem có payment nào chưa
        const payments = await queryRunner.query(`
            SELECT COUNT(*) as count FROM payments
        `);
        
        if (parseInt(payments[0].count) > 0) {
            console.log('⚠️  CẢNH BÁO: Đã có payments trong hệ thống!');
            console.log('⚠️  Không thể tự động fix debt_notes vì có thể ảnh hưởng đến dữ liệu thanh toán.');
            console.log('⚠️  Vui lòng fix thủ công hoặc backup database trước.');
            throw new Error('Cannot auto-fix debt_notes: payments exist');
        }

        // 2. Xóa tất cả debt_notes
        console.log('🗑️  Xóa tất cả debt_notes cũ...');
        await queryRunner.query(`DELETE FROM debt_notes`);

        // 3. Tạo lại debt_notes từ invoices
        console.log('🔄 Tạo lại debt_notes từ invoices...');
        
        // Lấy danh sách invoices có nợ, group theo customer + season
        const invoiceGroups = await queryRunner.query(`
            SELECT 
                customer_id,
                season_id,
                ARRAY_AGG(id ORDER BY created_at) as invoice_ids,
                SUM(CAST(remaining_amount AS DECIMAL)) as total_remaining,
                MIN(created_at) as first_invoice_date,
                MAX(created_by) as created_by
            FROM sales_invoices
            WHERE CAST(remaining_amount AS DECIMAL) > 0
                AND customer_id IS NOT NULL
                AND deleted_at IS NULL
            GROUP BY customer_id, season_id
        `);

        console.log(`📊 Tìm thấy ${invoiceGroups.length} nhóm nợ cần tạo debt_notes`);

        // 4. Tạo debt_note cho từng nhóm
        for (const group of invoiceGroups) {
            const code = this.generateDebtNoteCode();
            
            // Convert array sang JSON string
            const sourceInvoicesJson = JSON.stringify(group.invoice_ids);
            
            await queryRunner.query(`
                INSERT INTO debt_notes (
                    code,
                    customer_id,
                    season_id,
                    amount,
                    paid_amount,
                    remaining_amount,
                    status,
                    source_invoices,
                    created_by,
                    gift_description,
                    gift_value,
                    created_at,
                    updated_at
                ) VALUES (
                    $1, $2, $3, $4, 0, $4, 'active', $5::json, $6, NULL, 0, $7, $7
                )
            `, [
                code,
                group.customer_id,
                group.season_id,
                group.total_remaining,
                sourceInvoicesJson,
                group.created_by,
                group.first_invoice_date
            ]);

            console.log(`✅ Tạo debt_note ${code} cho customer #${group.customer_id}, season #${group.season_id}: ${parseFloat(group.total_remaining).toLocaleString()} đ`);
        }

        console.log('✅ Hoàn thành fix debt_notes!');
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        console.log('⚠️  Rollback: Không thể khôi phục debt_notes đã xóa!');
        console.log('⚠️  Vui lòng restore từ backup nếu cần.');
    }

    /**
     * Sinh mã debt_note
     */
    private generateDebtNoteCode(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        return `DN${year}${month}${day}${hours}${minutes}${seconds}${random}`;
    }
}
