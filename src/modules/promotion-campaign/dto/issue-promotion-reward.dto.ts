import { IsOptional, IsString } from 'class-validator';

export class IssuePromotionRewardDto {
  @IsOptional()
  @IsString()
  note?: string;
}
