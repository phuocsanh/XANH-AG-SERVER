import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmServiceCost } from '../../entities/farm-service-cost.entity';
import { FarmServiceCostService } from './farm-service-cost.service';
import { FarmServiceCostController } from './farm-service-cost.controller';

/**
 * Module quản lý chi phí dịch vụ/quà tặng dành cho nông dân
 */
@Module({
  imports: [TypeOrmModule.forFeature([FarmServiceCost])],
  controllers: [FarmServiceCostController],
  providers: [FarmServiceCostService],
  exports: [FarmServiceCostService], // Export để dùng ở module khác (VD: payment-allocation)
})
export class FarmServiceCostModule {}
