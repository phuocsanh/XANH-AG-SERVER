import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
config();

/**
 * Cấu hình kết nối cơ sở dữ liệu TypeORM
 * Chứa các thông số kết nối đến PostgreSQL database
 */
const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres', // Loại cơ sở dữ liệu
  host: process.env.DB_HOST || 'localhost', // Địa chỉ host của database
  port: parseInt(process.env.DB_PORT || '5432', 10), // Port của database
  username: process.env.DB_USERNAME || 'postgres', // Tên người dùng để kết nối database
  password: process.env.DB_PASSWORD || 'postgres', // Mật khẩu để kết nối database
  database: process.env.DB_NAME || 'GO_GN_FARM', // Tên database
  entities: [path.join(__dirname, '../entities/*.entity{.ts,.js}')], // Đường dẫn đến các entity
  migrations: [path.join(__dirname, '../database/migrations/*{.ts,.js}')], // Đường dẫn đến các migration
  synchronize: false, // Không tự động đồng bộ schema (nên để false trong production)
  logging: true, // Bật logging các câu query
};

export default typeOrmConfig;