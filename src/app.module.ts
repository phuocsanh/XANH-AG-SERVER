import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ProductModule } from './modules/product/product.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { FileTrackingModule } from './modules/file-tracking/file-tracking.module';
import { SalesModule } from './modules/sales/sales.module';
import { UploadModule } from './modules/upload/upload.module';
import typeOrmConfig from './config/typeorm.config';


/**
 * Module chính của ứng dụng NestJS
 * Import tất cả các module con và cấu hình các thành phần global
 */
@Module({
  imports: [
    // Cấu hình module environment variables với scope global
    ConfigModule.forRoot({ isGlobal: true }),

    // Cấu hình kết nối database với TypeORM
    TypeOrmModule.forRoot(typeOrmConfig),

    // Import các module chức năng
    ProductModule,
    UserModule,
    AuthModule,
    InventoryModule,
    FileTrackingModule,
    SalesModule,
    UploadModule,
  ],
  controllers: [], // Các controller global (nếu có)
  providers: [], // Các service global (nếu có)
})
export class AppModule {}
