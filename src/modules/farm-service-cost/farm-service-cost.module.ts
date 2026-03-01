import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmServiceCost } from '../../entities/farm-service-cost.entity';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';
import { FarmServiceCostService } from './farm-service-cost.service';
import { FarmServiceCostController } from './farm-service-cost.controller';
import { FarmGiftCostService } from './farm-gift-cost.service';
import { FarmGiftCostController } from './farm-gift-cost.controller';

/**
 * Module quản lý chi phí dịch vụ & quà tặng dành cho nông dân
 * Hiện đã tách bảng DB thành 2 nhưng vẫn quản lý chung trong module này
 */
@Module({
  imports: [TypeOrmModule.forFeature([FarmServiceCost, FarmGiftCost])],
  controllers: [FarmServiceCostController, FarmGiftCostController],
  providers: [FarmServiceCostService, FarmGiftCostService],
  exports: [FarmServiceCostService, FarmGiftCostService], 
})
export class FarmServiceCostModule {}
