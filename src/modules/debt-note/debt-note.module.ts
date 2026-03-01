import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtNoteService } from './debt-note.service';
import { DebtNoteController } from './debt-note.controller';
import { DebtNote } from '../../entities/debt-note.entity';
import { Customer } from '../../entities/customer.entity';
import { Season } from '../../entities/season.entity';
import { OperatingCostModule } from '../operating-cost/operating-cost.module';
import { OperatingCostCategoryModule } from '../operating-cost-category/operating-cost-category.module';
import { CustomerRewardModule } from '../customer-reward/customer-reward.module';

/**
 * DebtNoteModule - Module quản lý phiếu ghi nợ
 * 
 * Module này cung cấp các chức năng:
 * - Tạo phiếu ghi nợ cho khách hàng
 * - Tra cứu và tìm kiếm phiếu ghi nợ
 * - Cập nhật và xóa phiếu ghi nợ
 * - Theo dõi công nợ của khách hàng
 * - Theo dõi tích lũy và tặng quà cuối vụ
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DebtNote,
      Customer,
      Season,
    ]),
    OperatingCostModule,
    OperatingCostCategoryModule,
    CustomerRewardModule,
  ],
  controllers: [DebtNoteController],
  providers: [DebtNoteService],
  exports: [DebtNoteService],
})
export class DebtNoteModule {}
