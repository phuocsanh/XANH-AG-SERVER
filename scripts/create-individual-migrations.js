#!/usr/bin/env node

/**
 * Script tự động tạo migration riêng biệt cho từng entity
 * Thay vì tạo một file migration lớn chứa tất cả bảng,
 * script này sẽ tạo nhiều file migration nhỏ, mỗi file cho một bảng
 */

const fs = require('fs');
const path = require('path');

// Danh sách các entity và thông tin bảng tương ứng
const entities = [
  {
    name: 'Users',
    tableName: 'users',
    description: 'Tạo bảng users - thông tin người dùng'
  },
  {
    name: 'UserProfiles', 
    tableName: 'user_profiles',
    description: 'Tạo bảng user_profiles - thông tin chi tiết người dùng'
  },
  {
    name: 'ProductTypes',
    tableName: 'product_types', 
    description: 'Tạo bảng product_types - loại sản phẩm'
  },
  {
    name: 'ProductSubtypes',
    tableName: 'product_subtypes',
    description: 'Tạo bảng product_subtypes - loại phụ sản phẩm'
  },
  {
    name: 'Products',
    tableName: 'products',
    description: 'Tạo bảng products - thông tin sản phẩm'
  },
  {
    name: 'ProductSubtypeRelations',
    tableName: 'product_subtype_relations',
    description: 'Tạo bảng product_subtype_relations - quan hệ sản phẩm và loại phụ'
  },
  {
    name: 'Inventories',
    tableName: 'inventories',
    description: 'Tạo bảng inventories - lô hàng tồn kho'
  },
  {
    name: 'InventoryTransactions',
    tableName: 'inventory_transactions',
    description: 'Tạo bảng inventory_transactions - giao dịch kho'
  },
  {
    name: 'InventoryReceipts',
    tableName: 'inventory_receipts',
    description: 'Tạo bảng inventory_receipts - phiếu nhập kho'
  },
  {
    name: 'InventoryReceiptItems',
    tableName: 'inventory_receipt_items',
    description: 'Tạo bảng inventory_receipt_items - chi tiết phiếu nhập kho'
  },
  {
    name: 'SalesInvoices',
    tableName: 'sales_invoices',
    description: 'Tạo bảng sales_invoices - hóa đơn bán hàng'
  },
  {
    name: 'SalesInvoiceItems',
    tableName: 'sales_invoice_items',
    description: 'Tạo bảng sales_invoice_items - chi tiết hóa đơn bán hàng'
  },
  {
    name: 'FileUploads',
    tableName: 'file_uploads',
    description: 'Tạo bảng file_uploads - thông tin file upload'
  },
  {
    name: 'FileReferences',
    tableName: 'file_references',
    description: 'Tạo bảng file_references - tham chiếu file'
  }
];

// Thư mục chứa migration
const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');

// Tạo thư mục migrations nếu chưa tồn tại
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

// Hàm tạo timestamp cho migration
function generateTimestamp() {
  return Date.now();
}

// Hàm tạo nội dung migration
function createMigrationContent(entityName, tableName, description, timestamp) {
  const className = `Create${entityName}${timestamp}`;
  
  return `import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ${description}
 * Migration được tạo tự động bởi script create-individual-migrations.js
 */
export class ${className} implements MigrationInterface {
  name = '${className}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TODO: Thêm SQL CREATE TABLE cho bảng ${tableName}
    // Bạn cần copy SQL từ file InitialSchema.ts tương ứng với bảng này
    console.log('Creating table ${tableName}...');
    
    // Ví dụ:
    // await queryRunner.query(\`
    //   CREATE TABLE "${tableName}" (
    //     "id" SERIAL NOT NULL,
    //     "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    //     "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    //     CONSTRAINT "PK_${tableName}" PRIMARY KEY ("id")
    //   )
    // \`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Dropping table ${tableName}...');
    await queryRunner.query(\`DROP TABLE "${tableName}"\`);
  }
}
`;
}

// Tạo migration cho từng entity
function createIndividualMigrations() {
  console.log('🚀 Bắt đầu tạo migration riêng biệt cho từng entity...');
  
  let baseTimestamp = generateTimestamp();
  
  entities.forEach((entity, index) => {
    // Tăng timestamp để đảm bảo thứ tự chạy migration
    const timestamp = baseTimestamp + (index * 1000);
    const fileName = `${timestamp}-Create${entity.name}.ts`;
    const filePath = path.join(migrationsDir, fileName);
    
    const content = createMigrationContent(
      entity.name,
      entity.tableName,
      entity.description,
      timestamp
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Đã tạo migration: ${fileName}`);
  });
  
  console.log('\n🎉 Hoàn thành tạo tất cả migration!');
  console.log('\n📝 Lưu ý:');
  console.log('1. Bạn cần copy SQL CREATE TABLE từ file InitialSchema.ts vào từng migration tương ứng');
  console.log('2. Xóa file InitialSchema.ts sau khi copy xong');
  console.log('3. Chạy migration: npm run migration:run');
}

// Chạy script
if (require.main === module) {
  createIndividualMigrations();
}

module.exports = { createIndividualMigrations };