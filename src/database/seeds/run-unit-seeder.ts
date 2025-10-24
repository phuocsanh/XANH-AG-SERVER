import { DataSource } from 'typeorm';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config();
// Load environment variables from .env.local file (has higher priority)
config({ path: '.env.local' });

/**
 * Script để chạy unit seeder
 */
async function runUnitSeeder() {
  try {
    // Tạo DataSource với cấu hình từ environment variables
    const AppDataSource = new DataSource({
      type: 'postgres',
      ...(process.env.DATABASE_URL
        ? { url: process.env.DATABASE_URL }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_NAME || 'gn_argi',
          }),
      entities: [path.join(__dirname, '../../entities/*.entity{.ts,.js}')],
      synchronize: false,
      logging: false,
    });

    // Khởi tạo DataSource
    await AppDataSource.initialize();
    console.log('Đã kết nối đến cơ sở dữ liệu');

    // Import seeder sau khi DataSource được khởi tạo
    const { UnitSeeder } = await import('./unit.seeder');

    // Chạy seeder
    const seeder = new UnitSeeder(AppDataSource);
    await seeder.run();

    console.log('Hoàn tất seeding đơn vị tính');
  } catch (error) {
    console.error('Lỗi khi chạy seeder:', error);
  } finally {
    // Đóng kết nối (nếu cần)
    // Note: Trong thực tế, bạn có thể không muốn đóng kết nối nếu ứng dụng vẫn chạy
    console.log('Seeder hoàn tất');
  }
}

// Chạy seeder nếu file được thực thi trực tiếp
if (require.main === module) {
  runUnitSeeder();
}
