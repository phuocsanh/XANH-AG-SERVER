import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchSalesReturnDto extends BaseSearchDto {
  @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() code?: string;
  @IsNumber() @IsOptional() @Type(() => Number) customer_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) invoice_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) created_by?: number;
  
  @IsNumber() @IsOptional() @Type(() => Number) total_amount?: number;
  @IsNumber() @IsOptional() @Type(() => Number) refund_amount?: number;
  @IsNumber() @IsOptional() @Type(() => Number) final_amount?: number;
  
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() return_reason?: string;
  @IsString() @IsOptional() notes?: string;
  @IsDateString() @IsOptional() return_date?: string;
  @IsDateString() @IsOptional() created_at?: string;
  @IsDateString() @IsOptional() updated_at?: string;

  // Relations
  @IsString() @IsOptional() customer_name?: string;
  @IsString() @IsOptional() customer_phone?: string;
  @IsString() @IsOptional() invoice_code?: string;
}
