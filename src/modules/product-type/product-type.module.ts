import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductType } from '../../entities/product-types.entity';
import { ProductTypeService } from './product-type.service';
import { ProductTypeController } from './product-type.controller';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';

/**
 * ProductTypeModule - Module quản lý loại sản phẩm
 * 
 * Module này cung cấp các chức năng:
 * - Quản lý các loại sản phẩm nông nghiệp (phân bón, thuốc trừ sâu, v.v.)
 * - Tạo, cập nhật, xóa loại sản phẩm
 * - Quản lý hình ảnh và mô tả cho từng loại sản phẩm
 * - Phân loại sản phẩm theo nhóm để dễ dàng quản lý
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