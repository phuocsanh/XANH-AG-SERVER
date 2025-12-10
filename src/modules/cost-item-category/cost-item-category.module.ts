import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CostItemCategoryService } from './cost-item-category.service';
import { CostItemCategoryController } from './cost-item-category.controller';
import { CostItemCategory } from '../../entities/cost-item-category.entity';

/**
 * Module quản lý loại chi phí canh tác
 */
@Module({
  imports: [TypeOrmModule.forFeature([CostItemCategory])],
  controllers: [CostItemCategoryController],
  providers: [CostItemCategoryService],
  exports: [CostItemCategoryService],
})
export class CostItemCategoryModule {}
