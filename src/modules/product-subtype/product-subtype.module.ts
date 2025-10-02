import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductSubtype } from '../../entities/product-subtypes.entity';
import { ProductSubtypeService } from './product-subtype.service';
import { ProductSubtypeController } from './product-subtype.controller';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';

/**
 * Module quản lý loại phụ sản phẩm
 * Cung cấp các chức năng liên quan đến quản lý thông tin loại phụ sản phẩm
 */
@Module({
  imports: [
    // Import TypeORM feature module với ProductSubtype entity
    TypeOrmModule.forFeature([ProductSubtype]),
    // Import FileTrackingModule để sử dụng FileTrackingService
    FileTrackingModule,
  ],
  controllers: [ProductSubtypeController], // Controller xử lý các request liên quan đến loại phụ sản phẩm
  providers: [ProductSubtypeService], // Service xử lý logic nghiệp vụ loại phụ sản phẩm
  exports: [ProductSubtypeService], // Xuất ProductSubtypeService để các module khác có thể sử dụng
})
export class ProductSubtypeModule {}