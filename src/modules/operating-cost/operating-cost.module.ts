import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { OperatingCostService } from './operating-cost.service';
import { OperatingCostController } from './operating-cost.controller';

/**
 * OperatingCostModule - Module quản lý chi phí vận hành
 * 
 * Module này cung cấp các chức năng:
 * - Quản lý các khoản chi phí vận hành của doanh nghiệp
 * - Ghi nhận và phân loại chi phí theo từng mục
 * - Báo cáo và thống kê chi phí theo thời gian
 * - Hỗ trợ tính toán lợi nhuận và hiệu quả kinh doanh
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
