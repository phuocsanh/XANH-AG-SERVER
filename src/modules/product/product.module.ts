import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../entities/products.entity';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';
import { InventoryModule } from '../inventory/inventory.module';
import { UnitModule } from '../unit/unit.module';
import { ProductTypeModule } from '../product-type/product-type.module';
import { OperatingCostModule } from '../operating-cost/operating-cost.module';
import { UploadModule } from '../upload/upload.module';
import { ProductUnitConversionModule } from '../product-unit-conversion/product-unit-conversion.module';

/**
 * ProductModule - Module quản lý sản phẩm
 * 
 * Module này cung cấp các chức năng:
 * - Quản lý thông tin sản phẩm nông nghiệp (phân bón, thuốc trừ sâu, v.v.)
 * - Tạo, cập nhật, xóa sản phẩm với Factory Pattern
 * - Quản lý hình ảnh và file đính kèm sản phẩm
 * - Tích hợp với tồn kho, đơn vị tính, loại sản phẩm
 * - Tính toán giá bán dựa trên chi phí vận hành
 */
@Module({
  imports: [
    // Import TypeORM feature module với các entity liên quan đến sản phẩm
    TypeOrmModule.forFeature([Product]),
    // Import FileTrackingModule để sử dụng FileTrackingService
    FileTrackingModule,
    // Import InventoryModule để sử dụng InventoryService
    InventoryModule,
    // Import UnitModule để sử dụng UnitService
    UnitModule,
    // Import ProductTypeModule để sử dụng ProductTypeService
    ProductTypeModule,
    // Import OperatingCostModule để sử dụng OperatingCostService
    OperatingCostModule,
    // Import UploadModule để sử dụng UploadService (xóa ảnh cũ)
    UploadModule,
    // Import ProductUnitConversionModule để quản lý quy đổi đơn vị
    ProductUnitConversionModule,
  ],
  controllers: [
    ProductController, // Controller xử lý các request liên quan đến sản phẩm
  ],
  providers: [
    ProductService, // Service xử lý logic nghiệp vụ sản phẩm
  ],
  exports: [ProductService], // Xuất ProductService để các module khác có thể sử dụng
})
export class ProductModule {}
