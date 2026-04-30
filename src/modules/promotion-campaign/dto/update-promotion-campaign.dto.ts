import { PartialType } from '@nestjs/mapped-types';
import { CreatePromotionCampaignDto } from './create-promotion-campaign.dto';

export class UpdatePromotionCampaignDto extends PartialType(
  CreatePromotionCampaignDto,
) {}
