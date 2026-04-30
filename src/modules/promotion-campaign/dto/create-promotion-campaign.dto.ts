import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RewardMonthlyReleaseDto {
  @IsInt()
  @Min(1)
  month_index!: number;

  @IsInt()
  @Min(0)
  release_quantity!: number;
}

class RewardConfigDto {
  @IsString()
  @IsNotEmpty()
  reward_name!: string;

  @IsNumber()
  @Min(0.01)
  reward_value!: number;

  @IsInt()
  @Min(1)
  total_quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RewardMonthlyReleaseDto)
  monthly_release!: RewardMonthlyReleaseDto[];
}

export class CreatePromotionCampaignDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDateString()
  start_at!: string;

  @IsDateString()
  end_at!: string;

  @IsNumber()
  @Min(0.01)
  threshold_amount!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  base_win_rate!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  second_win_rate?: number = 2;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_reward_per_customer?: number = 2;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  product_ids!: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RewardConfigDto)
  rewards!: RewardConfigDto[];
}
