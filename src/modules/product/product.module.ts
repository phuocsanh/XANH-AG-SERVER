import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../entities/product.entity';
import { ProductType } from '../../entities/product-type.entity';
import { ProductSubtype } from '../../entities/product-subtype.entity';
import { ProductSubtypeRelation } from '../../entities/product-subtype-relation.entity';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';

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
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
