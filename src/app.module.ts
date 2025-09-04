import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
// import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
// import { APP_GUARD } from '@nestjs/core';
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

    // Cấu hình rate limiting với nhiều mức độ khác nhau
    // ThrottlerModule.forRoot([
    //   {
    //     name: 'short',
    //     ttl: 1000, // 1 giây
    //     limit: 3, // Tối đa 3 requests trong 1 giây
    //   },
    //   {
    //     name: 'medium',
    //     ttl: 10000, // 10 giây
    //     limit: 20, // Tối đa 20 requests trong 10 giây
    //   },
    //   {
    //     name: 'long',
    //     ttl: 60000, // 1 phút
    //     limit: 100, // Tối đa 100 requests trong 1 phút
    //   },
    // ]),

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
  providers: [
    // Đăng ký ThrottlerGuard như một global guard
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
  ]
})
export class AppModule {}
