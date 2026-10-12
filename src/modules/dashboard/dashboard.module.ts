import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { DebtNote } from '../../entities/debt-note.entity';
import { Customer } from '../../entities/customer.entity';
import { Product } from '../../entities/products.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { SystemSetting } from '../../entities/system-setting.entity';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { PromotionRewardReservation } from '../../entities/promotion-reward-reservation.entity';
import { Season } from '../../entities/season.entity';
import { Loan } from '../../entities/loan.entity';

/**
 * DashboardModule - Module cung cấp API thống kê cho Dashboard admin
 *
 * Bao gồm các endpoint:
 * - /dashboard/stats - KPIs tổng quan (doanh thu, công nợ, tồn kho)
 * - /dashboard/revenue - Doanh thu theo thời gian với so sánh YoY
 * - /dashboard/receivables - Công nợ phải thu, aging, top khách hàng nợ
 * - /dashboard/inventory - Tốn kho, sản phẩm sắp hết, sắp hết hạn
 * - /dashboard/sales-performance/top-products - Top sản phẩm bán chạm
 * - /dashboard/sales-performance/top-customers - Top khách hàng
 * - /dashboard/sales-performance/top-employees - Top nhân viên bán hàng
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesInvoice,
      DebtNote,
      Customer,
      Product,
      InventoryBatch,
      SystemSetting,
      OperatingCost,
      FarmGiftCost,
      CustomerRewardHistory,
      PromotionRewardReservation,
      Season,
      Loan,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
