import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { HarvestRecord } from '../../entities/harvest-record.entity';
import { ProfitReportService } from './profit-report.service';
import { ProfitReportController } from './profit-report.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RiceCrop, CostItem, HarvestRecord])],
  controllers: [ProfitReportController],
  providers: [ProfitReportService],
  exports: [ProfitReportService],
})
export class ProfitReportModule {}
