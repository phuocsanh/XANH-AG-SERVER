import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchOperatingCostDto extends BaseSearchDto {
  @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() code?: string;
  @IsNumber() @IsOptional() @Type(() => Number) season_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) rice_crop_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) cost_type_id?: number;
  
  @IsNumber() @IsOptional() @Type(() => Number) amount?: number;
  @IsDateString() @IsOptional() expense_date?: string;
  @IsString() @IsOptional() notes?: string;
  @IsDateString() @IsOptional() created_at?: string;

  // Relations
  @IsString() @IsOptional() season_name?: string;
  @IsString() @IsOptional() rice_crop_name?: string;
  @IsString() @IsOptional() cost_type_name?: string;
}
