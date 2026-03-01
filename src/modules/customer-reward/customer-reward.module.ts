import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { CustomerRewardService } from './customer-reward.service';
import { CustomerRewardController } from './customer-reward.controller';

import { DebtNote } from '../../entities/debt-note.entity';
import { SystemSetting } from '../../entities/system-setting.entity';
import { FarmServiceCostModule } from '../farm-service-cost/farm-service-cost.module';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerRewardTracking, 
      CustomerRewardHistory, 
      DebtNote,
      SystemSetting,
      FarmGiftCost
    ]),
    FarmServiceCostModule,
  ],
  controllers: [CustomerRewardController],
  providers: [CustomerRewardService],
  exports: [CustomerRewardService],
})
export class CustomerRewardModule {}
