import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from "typeorm";

export class CreateCustomerTable1763987882027 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Tạo bảng customers
        await queryRunner.createTable(new Table({
            name: 'customers',
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
                    isNullable: false,
                    comment: 'Mã khách hàng (KH001, KH002...)'
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                    comment: 'Tên khách hàng'
                },
                {
                    name: 'phone',
                    type: 'varchar',
                    length: '20',
                    isUnique: true,
                    isNullable: false,
                    comment: 'Số điện thoại'
                },
                {
                    name: 'email',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                    comment: 'Email'
                },
                {
                    name: 'address',
                    type: 'text',
                    isNullable: true,
                    comment: 'Địa chỉ'
                },
                {
                    name: 'type',
                    type: 'enum',
                    enum: ['regular', 'vip', 'wholesale'],
                    default: "'regular'",
                    isNullable: false,
                    comment: 'Loại khách hàng'
                },
                {
                    name: 'is_guest',
                    type: 'boolean',
                    default: false,
                    isNullable: false,
                    comment: 'Khách vãng lai'
                },
                {
                    name: 'tax_code',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                    comment: 'Mã số thuế'
                },
                {
                    name: 'notes',
                    type: 'text',
                    isNullable: true,
                    comment: 'Ghi chú'
                },
                {
                    name: 'total_purchases',
                    type: 'int',
                    default: 0,
                    isNullable: false,
                    comment: 'Tổng số lần mua'
                },
                {
                    name: 'total_spent',
                    type: 'decimal',
                    precision: 15,
                    scale: 2,
                    default: 0,
                    isNullable: false,
                    comment: 'Tổng tiền đã chi'
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false
                },
                {
                    name: 'updated_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP',
                    isNullable: false
                }
            ]
        }), true);

        // Thêm cột customer_id vào bảng sales_invoices
        await queryRunner.addColumn('sales_invoices', new TableColumn({
            name: 'customer_id',
            type: 'int',
            isNullable: true,
            comment: 'ID khách hàng (nullable cho khách vãng lai)'
        }));

        // Tạo foreign key từ sales_invoices.customer_id → customers.id
        await queryRunner.createForeignKey('sales_invoices', new TableForeignKey({
            columnNames: ['customer_id'],
            referencedTableName: 'customers',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',  // Nếu xóa khách hàng, set NULL (giữ lại hóa đơn)
            onUpdate: 'CASCADE'
        }));

        // Insert một số khách hàng mẫu
        await queryRunner.query(`
            INSERT INTO customers (code, name, phone, email, address, type, total_purchases, total_spent) VALUES
            ('KH001', 'Nguyễn Văn A', '0123456789', 'nguyenvana@gmail.com', '123 Đường ABC, TP.HCM', 'vip', 15, 50000000),
            ('KH002', 'Trần Thị B', '0987654321', 'tranthib@gmail.com', '456 Đường XYZ, Hà Nội', 'regular', 5, 10000000),
            ('KH003', 'Nông Trại C', '0369852147', 'nongtrai@gmail.com', '789 Đường DEF, Đồng Nai', 'wholesale', 20, 100000000)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Xóa foreign key
        const table = await queryRunner.getTable('sales_invoices');
        const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.indexOf('customer_id') !== -1);
        if (foreignKey) {
            await queryRunner.dropForeignKey('sales_invoices', foreignKey);
        }

        // Xóa cột customer_id
        await queryRunner.dropColumn('sales_invoices', 'customer_id');

        // Xóa bảng customers
        await queryRunner.dropTable('customers');
    }

}
