import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductType } from '../../entities/product-types.entity';
import { ProductTypeService } from './product-type.service';
import { ProductTypeController } from './product-type.controller';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';

/**
 * Module quản lý loại sản phẩm
 * Cung cấp các chức năng liên quan đến quản lý loại sản phẩm nông nghiệp
 */
@Module({
  imports: [
    // Import TypeORM feature module với entity ProductType
    TypeOrmModule.forFeature([ProductType]),
    // Import FileTrackingModule để sử dụng FileTrackingService
    FileTrackingModule,
  ],
  controllers: [ProductTypeController], // Controller xử lý các request liên quan đến loại sản phẩm
  providers: [ProductTypeService], // Service xử lý logic nghiệp vụ loại sản phẩm
  exports: [ProductTypeService], // Xuất ProductTypeService để các module khác có thể sử dụng
})
export class ProductTypeModule {}