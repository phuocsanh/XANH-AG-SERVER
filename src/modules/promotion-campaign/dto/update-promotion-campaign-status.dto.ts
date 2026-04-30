import { IsIn, IsString } from 'class-validator';

export class UpdatePromotionCampaignStatusDto {
  @IsString()
  @IsIn(['draft', 'active', 'ended', 'archived'])
  status!: string;
}
