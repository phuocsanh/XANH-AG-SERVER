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
 * Chọn DATABASE_URL dựa trên môi trường:
 * - Development: Ưu tiên DATABASE_URL_DEV, fallback về DATABASE_URL
 * - Production: Dùng DATABASE_URL
 */
const getDatabaseUrl = () => {
  if (isProduction) {
    return process.env.DATABASE_URL;
  }
  // Dev: Ưu tiên DATABASE_URL_DEV
  return process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;
};

const databaseUrl = getDatabaseUrl();

/**
 * Cấu hình kết nối cơ sở dữ liệu TypeORM
 * Chứa các thông số kết nối đến PostgreSQL database
 * Tự động điều chỉnh theo môi trường (development/production)
 */
const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres', // Loại cơ sở dữ liệu
  // Sử dụng connection string nếu có, nếu không thì dùng các biến môi trường riêng lẻ
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: process.env.DB_HOST || 'localhost', // Địa chỉ host của database
        port: parseInt(process.env.DB_PORT || '5432', 10), // Port của database
        username: process.env.DB_USERNAME || 'postgres', // Tên người dùng để kết nối database
        password: process.env.DB_PASSWORD || 'postgres', // Mật khẩu để kết nối database
        database: process.env.DB_NAME || 'gn_argi', // Tên database
      }),
  ssl: !!databaseUrl, // Bật SSL nếu dùng connection string (thường là cloud DB như Supabase)
  extra: databaseUrl
    ? {
        ssl: {
          rejectUnauthorized: false, // Chấp nhận self-signed cert (cần thiết cho một số cloud provider)
        },
        // ===== SUPABASE FREE TIER OPTIMIZATION =====
        // Supabase Free có giới hạn ~60 connections đồng thời
        // Giảm pool size để tránh vượt quá giới hạn
        max: 3,                      // Tối đa 3 connections (giảm từ 5)
        min: 1,                      // Tối thiểu 1 connection
        
        // Timeout settings - Tăng lên để tránh ETIMEDOUT
        connectionTimeoutMillis: 20000,  // 20 giây (tăng từ 30s để nhanh hơn)
        query_timeout: 15000,            // 15 giây query timeout
        statement_timeout: 15000,        // 15 giây statement timeout
        
        // Idle connection management
        idleTimeoutMillis: 30000,        // Đóng connection sau 30s không dùng
        
        // Keep alive để maintain connection với Supabase
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000, // 10 giây
        
        // Application name để debug trên Supabase Dashboard
        application_name: 'xanh-ag-server',
        
        // ===== TRANSACTION POOLER (PGBOUNCER) OPTIMIZATION =====
        // Nếu dùng port 6543 (Transaction Pooler), cần tắt prepared statements
        // PgBouncer không hỗ trợ prepared statements trong transaction mode
        // Xem: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
        prepareStatements: false,  // TẮT prepared statements cho pgbouncer
      }
    : undefined,
  entities: [path.join(__dirname, '../entities/*.entity{.ts,.js}')], // Đường dẫn đến các entity
  // migrations: [path.join(__dirname, '../database/migrations/*{.ts,.js}')], // ĐÃ XÓA MIGRATIONS
  
  // Tự động đồng bộ schema từ entities
  // TypeORM sẽ tự tạo/update tables dựa trên entities khi khởi động
  // ⚠️ CHÚ Ý: Chỉ dùng synchronize: true trong development, KHÔNG dùng trong production
  synchronize: true, // TỰ ĐỘNG TẠO BẢNG TỪ ENTITIES
  
  // Logging
  logging: isProduction ? ['error', 'warn'] : true,
  
  // ===== CONNECTION POOL SETTINGS (OPTIMIZED FOR SUPABASE) =====
  // Supabase Free tier giới hạn ~60 connections
  // Giảm pool size để tránh connection timeout
  poolSize: isProduction ? 5 : 3,  // Dev: 3, Prod: 5 (giảm từ 10)
  
  // ===== RETRY CONNECTION (IMPORTANT FOR SUPABASE) =====
  // Supabase có thể pause database sau 1 tuần không hoạt động
  // Retry nhiều lần để "đánh thức" database
  retryAttempts: isProduction ? 5 : 3,  // Retry 3-5 lần
  retryDelay: 3000,                     // Chờ 3 giây giữa các lần retry
  
  // Connection timeout
  connectTimeoutMS: 20000, // 20 giây (giảm từ 30s để fail fast hơn)
};

export default typeOrmConfig;
