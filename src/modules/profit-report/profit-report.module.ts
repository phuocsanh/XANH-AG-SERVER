import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { HarvestRecord } from '../../entities/harvest-record.entity';
import { ProfitReportService } from './profit-report.service';
import { ProfitReportController } from './profit-report.controller';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { ExternalPurchase } from '../../entities/external-purchase.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    RiceCrop, 
    CostItem, 
    HarvestRecord,
    SalesInvoice,
    ExternalPurchase
  ])],
  controllers: [ProfitReportController],
  providers: [ProfitReportService],
  exports: [ProfitReportService],
})
export class ProfitReportModule {}
