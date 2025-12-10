import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatingCostCategoryService } from './operating-cost-category.service';
import { OperatingCostCategoryController } from './operating-cost-category.controller';
import { OperatingCostCategory } from '../../entities/operating-cost-category.entity';

/**
 * Module quản lý loại chi phí vận hành
 */
@Module({
  imports: [TypeOrmModule.forFeature([OperatingCostCategory])],
  controllers: [OperatingCostCategoryController],
  providers: [OperatingCostCategoryService],
  exports: [OperatingCostCategoryService],
})
export class OperatingCostCategoryModule {}
