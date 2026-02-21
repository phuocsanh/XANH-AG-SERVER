import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductUnitConversion } from '../../entities/product-unit-conversions.entity';
import { ProductUnitConversionService } from './product-unit-conversion.service';
import { ProductUnitConversionController } from './product-unit-conversion.controller';

/**
 * Module quản lý quy đổi đơn vị tính sản phẩm.
 * Ví dụ: 1 BAO = 50 KG, 1 TẠ = 100 KG...
 * Export ProductUnitConversionService để các module khác (inventory, sales) dùng.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProductUnitConversion])],
  controllers: [ProductUnitConversionController],
  providers: [ProductUnitConversionService],
  exports: [ProductUnitConversionService], // Export để InventoryModule và SalesModule sử dụng
})
export class ProductUnitConversionModule {}
