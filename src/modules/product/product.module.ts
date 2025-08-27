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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductType,
      ProductSubtype,
      ProductSubtypeRelation,
    ]),
  ],
  controllers: [ProductController],
  providers: [
    ProductService,
    ProductFactoryRegistry,
    FertilizerProductFactory,
    PesticideProductFactory,
  ],
  exports: [ProductService],
})
export class ProductModule {}
