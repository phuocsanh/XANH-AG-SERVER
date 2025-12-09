import { IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchPaymentDto extends BaseSearchDto {
  // --- Entity Fields ---
  @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() code?: string;
  @IsNumber() @IsOptional() @Type(() => Number) customer_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) amount?: number;
  @IsString() @IsOptional() payment_date?: string; // DateString
  @IsString() @IsOptional() payment_method?: string;
  @IsString() @IsOptional() notes?: string;
  @IsDateString() @IsOptional() created_at?: string;
  @IsDateString() @IsOptional() updated_at?: string;
  @IsNumber() @IsOptional() @Type(() => Number) created_by?: number;

  // --- Relations Flat Fields ---
  @IsString() @IsOptional() debt_note_code?: string;
  @IsString() @IsOptional() customer_name?: string;
  @IsString() @IsOptional() customer_phone?: string;
}
