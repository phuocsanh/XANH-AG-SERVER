import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../entities/product.entity';
import { ProductType } from '../../entities/product-type.entity';
import { ProductSubtype } from '../../entities/product-subtype.entity';
import { ProductSubtypeRelation } from '../../entities/product-subtype-relation.entity';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { ProductFactoryRegistry } from './factories/product-factory.registry';
import { FertilizerProductFactory } from './factories/fertilizer-product.factory';
import { PesticideProductFactory } from './factories/pesticide-product.factory';

/**
 * Module quản lý sản phẩm
 * Cung cấp các chức năng liên quan đến quản lý thông tin sản phẩm nông nghiệp
 */
@Module({
  imports: [
    // Import TypeORM feature module với các entity liên quan đến sản phẩm
    TypeOrmModule.forFeature([
      Product,
      ProductType,
      ProductSubtype,
      ProductSubtypeRelation,
    ]),
  ],
  controllers: [ProductController], // Controller xử lý các request liên quan đến sản phẩm
  providers: [
    ProductService, // Service xử lý logic nghiệp vụ sản phẩm
    ProductFactoryRegistry, // Registry quản lý các factory tạo sản phẩm
    FertilizerProductFactory, // Factory tạo sản phẩm phân bón
    PesticideProductFactory, // Factory tạo sản phẩm thuốc trừ sâu
  ],
  exports: [ProductService], // Xuất ProductService để các module khác có thể sử dụng
})
export class ProductModule {}
