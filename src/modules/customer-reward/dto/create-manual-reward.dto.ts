import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateManualRewardDto {
  @IsNumber()
  customer_id!: number;

  @IsString()
  gift_description!: string;

  @IsNumber()
  @IsOptional()
  gift_value?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  @IsNumber()
  manual_deduct_amount?: number;

  @IsOptional()
  @IsNumber()
  season_id?: number;

  @IsOptional()
  @IsNumber()
  rice_crop_id?: number;
}
