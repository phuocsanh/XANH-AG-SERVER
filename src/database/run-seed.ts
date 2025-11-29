import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { seedRBAC } from './seeds/rbac-seed';

import { DataSource } from 'typeorm';

/**
 * Script chạy seed dữ liệu RBAC
 */
async function runSeed() {
  console.log('🚀 Khởi động seed RBAC...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    await seedRBAC(dataSource);
    console.log('\n✅ Seed RBAC thành công!');
  } catch (error) {
    console.error('\n❌ Lỗi khi seed RBAC:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runSeed();
