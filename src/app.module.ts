import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductModule } from './modules/product/product.module';
import { ProductTypeModule } from './modules/product-type/product-type.module';
import { ProductSubtypeModule } from './modules/product-subtype/product-subtype.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { FileTrackingModule } from './modules/file-tracking/file-tracking.module';
import { SalesModule } from './modules/sales/sales.module';
import { UploadModule } from './modules/upload/upload.module';
import { AiAnalysisModule } from './modules/ai-analysis/ai-analysis.module';
import { WeatherForecastModule } from './modules/weather-forecast/weather-forecast.module';
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
    ProductTypeModule,
    ProductSubtypeModule,
    UserModule,
    AuthModule,
    InventoryModule,
    FileTrackingModule,
    SalesModule,
    UploadModule,
    AiAnalysisModule, // Module phân tích AI thị trường lúa gạo
    WeatherForecastModule, // Module dự báo thời tiết
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
