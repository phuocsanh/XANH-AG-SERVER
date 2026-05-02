import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerPromotionLedger } from '../../entities/customer-promotion-ledger.entity';
import { CustomerPromotionOverride } from '../../entities/customer-promotion-override.entity';
import { CustomerPromotionProgress } from '../../entities/customer-promotion-progress.entity';
import { CustomerPromotionSpinLog } from '../../entities/customer-promotion-spin-log.entity';
import { Product } from '../../entities/products.entity';
import { PromotionCampaign } from '../../entities/promotion-campaign.entity';
import { PromotionCampaignProduct } from '../../entities/promotion-campaign-product.entity';
import { PromotionRewardPool } from '../../entities/promotion-reward-pool.entity';
import { PromotionRewardReleaseSchedule } from '../../entities/promotion-reward-release-schedule.entity';
import { PromotionRewardReservation } from '../../entities/promotion-reward-reservation.entity';
import { PromotionCampaignController } from './promotion-campaign.controller';
import { PromotionCampaignService } from './promotion-campaign.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PromotionCampaign,
      PromotionCampaignProduct,
      CustomerPromotionProgress,
      CustomerPromotionOverride,
      CustomerPromotionLedger,
      CustomerPromotionSpinLog,
      PromotionRewardPool,
      PromotionRewardReleaseSchedule,
      PromotionRewardReservation,
      Product,
    ]),
  ],
  controllers: [PromotionCampaignController],
  providers: [PromotionCampaignService],
  exports: [PromotionCampaignService],
})
export class PromotionCampaignModule {}
