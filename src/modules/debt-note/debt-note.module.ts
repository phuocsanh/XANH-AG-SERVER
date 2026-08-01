import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtNoteService } from './debt-note.service';
import { DebtNoteController } from './debt-note.controller';
import { DebtNote } from '../../entities/debt-note.entity';
import { DebtNoteClosure } from '../../entities/debt-note-closure.entity';
import { Customer } from '../../entities/customer.entity';
import { Season } from '../../entities/season.entity';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { OperatingCostModule } from '../operating-cost/operating-cost.module';
import { OperatingCostCategoryModule } from '../operating-cost-category/operating-cost-category.module';
import { CustomerRewardModule } from '../customer-reward/customer-reward.module';
import { InventoryModule } from '../inventory/inventory.module';

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
      DebtNoteClosure,
      Customer,
      Season,
      CustomerRewardTracking,
      CustomerRewardHistory,
      FarmGiftCost,
      InventoryTransaction,
    ]),
    OperatingCostModule,
    OperatingCostCategoryModule,
    CustomerRewardModule,
    InventoryModule,
  ],
  controllers: [DebtNoteController],
  providers: [DebtNoteService],
  exports: [DebtNoteService],
})
export class DebtNoteModule {}
