import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchProductDto extends BaseSearchDto {
  @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() name?: string;
  
  @IsNumber() @IsOptional() @Type(() => Number) unit_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) type_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) subtype_id?: number;

  @IsNumber() @IsOptional() @Type(() => Number) purchase_price?: number;
  @IsNumber() @IsOptional() @Type(() => Number) wholesale_price?: number;
  @IsNumber() @IsOptional() @Type(() => Number) retail_price?: number;

  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() status?: string; // active/inactive if any
  @IsDateString() @IsOptional() created_at?: string;
  @IsDateString() @IsOptional() updated_at?: string;
  @IsOptional() has_input_invoice?: boolean;

  // Relations
  @IsString() @IsOptional() unit_name?: string;
  @IsString() @IsOptional() type_name?: string;
  @IsString() @IsOptional() subtype_name?: string;
}
