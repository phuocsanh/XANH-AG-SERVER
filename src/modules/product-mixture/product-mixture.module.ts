import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductMixture } from '../../entities/product-mixtures.entity';
import { ProductMixtureItem } from '../../entities/product-mixture-items.entity';
import { Product } from '../../entities/products.entity';
import { ProductComponent } from '../../entities/product-components.entity';
import { ProductMixtureService } from './product-mixture.service';
import { ProductMixtureController } from './product-mixture.controller';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductMixture,
      ProductMixtureItem,
      Product,
      ProductComponent,
    ]),
    InventoryModule,
  ],
  controllers: [ProductMixtureController],
  providers: [ProductMixtureService],
  exports: [ProductMixtureService],
})
export class ProductMixtureModule {}
