import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchInventoryDto extends BaseSearchDto {
  @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() code?: string; // batch code
  @IsNumber() @IsOptional() @Type(() => Number) product_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) supplier_id?: number;
  
  @IsNumber() @IsOptional() @Type(() => Number) quantity?: number;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() payment_status?: string;
  @IsString() @IsOptional() notes?: string;
  @IsDateString() @IsOptional() created_at?: string;
  @IsDateString() @IsOptional() import_date?: string;
  @IsDateString() @IsOptional() expire_date?: string;

  // Relation
  @IsString() @IsOptional() product_name?: string;
  @IsString() @IsOptional() product_code?: string;
  @IsString() @IsOptional() supplier_name?: string;
}
