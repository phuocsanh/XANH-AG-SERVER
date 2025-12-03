import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreProfitReportService } from './store-profit-report.service';
import { StoreProfitReportController } from './store-profit-report.controller';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { Season } from '../../entities/season.entity';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { DeliveryLog } from '../../entities/delivery-log.entity';

/**
 * Module quản lý báo cáo lợi nhuận cửa hàng
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesInvoice,
      Season,
      OperatingCost,
      DeliveryLog,
    ]),
  ],
  controllers: [StoreProfitReportController],
  providers: [StoreProfitReportService],
  exports: [StoreProfitReportService],
})
export class StoreProfitReportModule {}
