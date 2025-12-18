
import { createConnection } from 'typeorm';
import { InventoryAdjustment } from './src/entities/inventory-adjustments.entity';
import * as dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  console.log('🚀 Bắt đầu migrate dữ liệu status cho InventoryAdjustment...');
  
  const connection = await createConnection({
    type: 'postgres', // Hoặc type của bạn (mysql/postgres)
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'xanh_ag',
    entities: [InventoryAdjustment],
    synchronize: false,
  });

  const repository = connection.getRepository(InventoryAdjustment);
  
  // 1. Cập nhật 0 -> draft
  await repository.query("UPDATE inventory_adjustments SET status = 'draft' WHERE status = '0'");
  // 2. Cập nhật 2 -> approved
  await repository.query("UPDATE inventory_adjustments SET status = 'approved' WHERE status = '2'");
  // 3. Cập nhật 4 -> cancelled
  await repository.query("UPDATE inventory_adjustments SET status = 'cancelled' WHERE status = '4'");
  // 4. Cập nhật 3 -> completed
  await repository.query("UPDATE inventory_adjustments SET status = 'completed' WHERE status = '3'");

  console.log('✅ Hoàn thành migrate dữ liệu!');
  await connection.close();
}

migrate().catch(err => console.error('❌ Lỗi migrate:', err));
