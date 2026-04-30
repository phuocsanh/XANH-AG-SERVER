import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SelectPromotionRewardDto {
  @IsInt()
  @Min(1)
  customer_id!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
