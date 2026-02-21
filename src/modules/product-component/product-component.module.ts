import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductComponent } from '../../entities/product-components.entity';
import { ProductComponentService } from './product-component.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductComponent])],
  providers: [ProductComponentService],
  exports: [ProductComponentService],
})
export class ProductComponentModule {}
