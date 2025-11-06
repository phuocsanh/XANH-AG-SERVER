import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { OperatingCostService } from './operating-cost.service';
import { OperatingCostController } from './operating-cost.controller';

/**
 * Module quản lý chi phí vận hành
 */
@Module({
  imports: [
    // Import TypeORM feature module với entity OperatingCost
    TypeOrmModule.forFeature([OperatingCost]),
  ],
  controllers: [OperatingCostController], // Controller xử lý các request liên quan đến chi phí vận hành
  providers: [
    OperatingCostService, // Service xử lý logic nghiệp vụ chi phí vận hành
  ],
  exports: [
    OperatingCostService, // Xuất OperatingCostService để các module khác có thể sử dụng
    TypeOrmModule, // Xuất TypeOrmModule để các module khác có thể sử dụng repository
  ],
})
export class OperatingCostModule {}
