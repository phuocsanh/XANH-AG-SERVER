import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
config();
// Load environment variables from .env.local file (has higher priority)
config({ path: '.env.local' });

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Cấu hình kết nối cơ sở dữ liệu TypeORM
 * Chứa các thông số kết nối đến PostgreSQL database
 * Tự động điều chỉnh theo môi trường (development/production)
 */
const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres', // Loại cơ sở dữ liệu
  // Sử dụng connection string nếu có, nếu không thì dùng các biến môi trường riêng lẻ
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost', // Địa chỉ host của database
        port: parseInt(process.env.DB_PORT || '5432', 10), // Port của database
        username: process.env.DB_USERNAME || 'postgres', // Tên người dùng để kết nối database
        password: process.env.DB_PASSWORD || 'postgres', // Mật khẩu để kết nối database
        database: process.env.DB_NAME || 'gn_argi', // Tên database
      }),
  ssl: !!process.env.DATABASE_URL, // Bật SSL nếu dùng connection string (thường là cloud DB như Supabase)
  extra: process.env.DATABASE_URL
    ? {
        ssl: {
          rejectUnauthorized: false, // Chấp nhận self-signed cert (cần thiết cho một số cloud provider)
        },
      }
    : undefined,
  entities: [path.join(__dirname, '../entities/*.entity{.ts,.js}')], // Đường dẫn đến các entity
  migrations: [path.join(__dirname, '../database/migrations/*{.ts,.js}')], // Đường dẫn đến các migration
  
  // QUAN TRỌNG: Tắt synchronize trong production để tránh mất dữ liệu
  // Trong production, dùng migrations để quản lý schema
  synchronize: !isProduction, // Chỉ tự động đồng bộ schema trong development
  
  // Logging: chi tiết trong dev, chỉ errors trong prod
  logging: isProduction ? ['error', 'warn'] : true,
  
  // Connection pool settings
  poolSize: isProduction ? 10 : 5,
  
  // Retry connection
  retryAttempts: isProduction ? 10 : 3,
  retryDelay: 3000,
};

export default typeOrmConfig;
