import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SetForceWinDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  reward_pool_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  bucket_month?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
