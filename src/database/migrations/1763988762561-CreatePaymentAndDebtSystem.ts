import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreatePaymentAndDebtSystem1763988762561 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Tạo bảng payments (Phiếu thu)
        await queryRunner.createTable(new Table({
            name: 'payments',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'code',
                    type: 'varchar',
                    length: '50',
                    isUnique: true,
                    comment: 'Mã phiếu thu (PT001, PT002...)'
                },
                {
                    name: 'customer_id',
                    type: 'int',
                    comment: 'ID khách hàng'
                },
                {
                    name: 'amount',
                    type: 'decimal',
                    precision: 15,
                    scale: 2,
                    comment: 'Số tiền thu'
                },
                {
                    name: 'allocated_amount',
                    type: 'decimal',
                    precision: 15,
                    scale: 2,
                    default: 0,
                    comment: 'Số tiền đã phân bổ'
                },
                {
                    name: 'payment_date',
                    type: 'date',
                    comment: 'Ngày thu tiền'
                },
                {
                    name: 'payment_method',
                    type: 'varchar',
                    length: '50',
                    comment: 'Phương thức thanh toán'
                },
                {
                    name: 'notes',
                    type: 'text',
                    isNullable: true,
                    comment: 'Ghi chú'
                },
                {
                    name: 'created_by',
                    type: 'int',
                    isNullable: true
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP'
                }
            ]
        }), true);

        // 2. Tạo bảng debt_notes (Phiếu công nợ)
        await queryRunner.createTable(new Table({
            name: 'debt_notes',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'code',
                    type: 'varchar',
                    length: '50',
                    isUnique: true,
                    comment: 'Mã phiếu công nợ (DN001, DN002...)'
                },
                {
                    name: 'customer_id',
                    type: 'int',
                    comment: 'ID khách hàng'
                },
                {
                    name: 'season_id',
                    type: 'int',
                    isNullable: true,
                    comment: 'ID mùa vụ'
                },
                {
                    name: 'amount',
                    type: 'decimal',
                    precision: 15,
                    scale: 2,
                    comment: 'Số tiền nợ ban đầu'
                },
                {
                    name: 'paid_amount',
                    type: 'decimal',
                    precision: 15,
                    scale: 2,
                    default: 0,
                    comment: 'Số tiền đã trả'
                },
                {
                    name: 'remaining_amount',
                    type: 'decimal',
                    precision: 15,
                    scale: 2,
                    comment: 'Số tiền còn nợ'
                },
                {
                    name: 'status',
                    type: 'enum',
                    enum: ['active', 'paid', 'overdue', 'cancelled'],
                    default: "'active'",
                    comment: 'Trạng thái phiếu công nợ'
                },
                {
                    name: 'due_date',
                    type: 'date',
                    isNullable: true,
                    comment: 'Hạn trả'
                },
                {
                    name: 'notes',
                    type: 'text',
                    isNullable: true,
                    comment: 'Ghi chú'
                },
                {
                    name: 'source_invoices',
                    type: 'json',
                    isNullable: true,
                    comment: 'Danh sách ID hóa đơn gốc'
                },
                {
                    name: 'created_by',
                    type: 'int',
                    isNullable: true
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP'
                },
                {
                    name: 'updated_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP'
                }
            ]
        }), true);

        // 3. Tạo bảng payment_allocations (Phân bổ thanh toán)
        await queryRunner.createTable(new Table({
            name: 'payment_allocations',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'payment_id',
                    type: 'int',
                    comment: 'ID phiếu thu'
                },
                {
                    name: 'allocation_type',
                    type: 'enum',
                    enum: ['invoice', 'debt_note'],
                    default: "'debt_note'",
                    comment: 'Loại phân bổ'
                },
                {
                    name: 'invoice_id',
                    type: 'int',
                    isNullable: true,
                    comment: 'ID hóa đơn'
                },
                {
                    name: 'debt_note_id',
                    type: 'int',
                    isNullable: true,
                    comment: 'ID phiếu công nợ'
                },
                {
                    name: 'amount',
                    type: 'decimal',
                    precision: 15,
                    scale: 2,
                    comment: 'Số tiền phân bổ'
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP'
                }
            ]
        }), true);

        // 4. Tạo foreign keys
        await queryRunner.createForeignKey('payments', new TableForeignKey({
            columnNames: ['customer_id'],
            referencedTableName: 'customers',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE'
        }));

        await queryRunner.createForeignKey('debt_notes', new TableForeignKey({
            columnNames: ['customer_id'],
            referencedTableName: 'customers',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE'
        }));

        await queryRunner.createForeignKey('debt_notes', new TableForeignKey({
            columnNames: ['season_id'],
            referencedTableName: 'seasons',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL'
        }));

        await queryRunner.createForeignKey('payment_allocations', new TableForeignKey({
            columnNames: ['payment_id'],
            referencedTableName: 'payments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE'
        }));

        await queryRunner.createForeignKey('payment_allocations', new TableForeignKey({
            columnNames: ['invoice_id'],
            referencedTableName: 'sales_invoices',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL'
        }));

        await queryRunner.createForeignKey('payment_allocations', new TableForeignKey({
            columnNames: ['debt_note_id'],
            referencedTableName: 'debt_notes',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL'
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa foreign keys
        const paymentAllocations = await queryRunner.getTable('payment_allocations');
        const paymentAllocFKs = paymentAllocations?.foreignKeys || [];
        for (const fk of paymentAllocFKs) {
            await queryRunner.dropForeignKey('payment_allocations', fk);
        }

        const debtNotes = await queryRunner.getTable('debt_notes');
        const debtNoteFKs = debtNotes?.foreignKeys || [];
        for (const fk of debtNoteFKs) {
            await queryRunner.dropForeignKey('debt_notes', fk);
        }

        const payments = await queryRunner.getTable('payments');
        const paymentFKs = payments?.foreignKeys || [];
        for (const fk of paymentFKs) {
            await queryRunner.dropForeignKey('payments', fk);
        }

        // Xóa bảng
        await queryRunner.dropTable('payment_allocations');
        await queryRunner.dropTable('debt_notes');
        await queryRunner.dropTable('payments');
    }

}
