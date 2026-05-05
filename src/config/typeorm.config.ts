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
  ssl: !!databaseUrl, // Bật SSL nếu dùng connection string cloud (Neon/Postgres managed)
  extra: databaseUrl
    ? {
        ssl: {
          rejectUnauthorized: false, // Chấp nhận self-signed cert (cần thiết cho một số cloud provider)
        },
        // ===== CLOUD POSTGRES / POOLER SETTINGS =====
        // Giu pool nho de an toan voi serverless pooler nhu Neon
        max: 3,
        min: 1,
        
        // Timeout settings - Tăng lên để tránh ETIMEDOUT
        connectionTimeoutMillis: 20000,  // 20 giây (tăng từ 30s để nhanh hơn)
        query_timeout: 15000,            // 15 giây query timeout
        statement_timeout: 15000,        // 15 giây statement timeout
        
        // Idle connection management
        idleTimeoutMillis: 30000,        // Đóng connection sau 30s không dùng
        
        // Keep alive để maintain connection với DB pooler
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000, // 10 giây
        
        // Application name để debug trên dashboard provider
        application_name: 'xanh-ag-server',
        
        // ===== TRANSACTION POOLER (PGBOUNCER) OPTIMIZATION =====
        // Nếu dùng port 6543 (Transaction Pooler), cần tắt prepared statements
        // PgBouncer không hỗ trợ prepared statements trong transaction mode
        prepareStatements: false,  // TẮT prepared statements cho pgbouncer
      }
    : undefined,
  entities: [path.join(__dirname, '../entities/*.entity{.ts,.js}')], // Đường dẫn đến các entity
  // migrations: [path.join(__dirname, '../database/migrations/*{.ts,.js}')], // ĐÃ XÓA MIGRATIONS
  
  // Chỉ tự đồng bộ schema trong development. Production phải dùng migration để có backfill/constraint đúng.
  synchronize: !isProduction,
  
  // Logging
  logging: isProduction ? ['error', 'warn'] : true,
  
  // ===== CONNECTION POOL SETTINGS =====
  // Giu pool size vua phai de tranh timeout tren managed Postgres/pooler
  poolSize: isProduction ? 5 : 3,  // Dev: 3, Prod: 5 (giảm từ 10)
  
  // ===== RETRY CONNECTION =====
  // Managed Postgres/pooler co the cold-start/cham nhat thoi
  retryAttempts: isProduction ? 5 : 3,  // Retry 3-5 lần
  retryDelay: 3000,                     // Chờ 3 giây giữa các lần retry
  
  // Connection timeout
  connectTimeoutMS: 20000, // 20 giây (giảm từ 30s để fail fast hơn)
  
  // Chỉ định rõ schema để tránh lỗi "no schema has been selected"
  schema: 'public',
};

export default typeOrmConfig;
