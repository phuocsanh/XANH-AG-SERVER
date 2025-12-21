import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Chọn DATABASE_URL dựa trên môi trường:
 * - Development: Ưu tiên DATABASE_URL_DEV
 * - Production: Dùng DATABASE_URL
 */
const getDatabaseUrl = () => {
  if (isProduction) {
    return process.env.DATABASE_URL || 'NO_DATABASE_URL';
  }
  return process.env.DATABASE_URL_DEV || 'NO_DATABASE_URL_DEV';
};

const databaseUrl = getDatabaseUrl();
const hasSSL = !!process.env.DATABASE_URL || !!process.env.DATABASE_URL_DEV;

/**
 * DataSource cho TypeORM CLI (migrations)
 * File này được dùng riêng cho việc chạy migrations
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,  // Non-null assertion - đảm bảo sẽ có giá trị
  ssl: hasSSL ? { rejectUnauthorized: false } : false,
  entities: ['src/entities/*.entity.ts'],
  // migrations: ['src/database/migrations/*.ts'], // Đã xóa migrations
  synchronize: true, // TỰ ĐỘNG TẠO BẢNG TỪ ENTITIES KHI KHỞI ĐỘNG
  logging: ['error', 'warn'],
});
