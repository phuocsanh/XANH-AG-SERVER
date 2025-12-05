import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

const hasSSL = !!process.env.DATABASE_URL;

/**
 * DataSource cho TypeORM CLI (migrations)
 * File này được dùng riêng cho việc chạy migrations
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://localhost:5432/gn_argi',
  ssl: hasSSL ? { rejectUnauthorized: false } : false,
  entities: ['dist/entities/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
  logging: ['error', 'warn'],
});
