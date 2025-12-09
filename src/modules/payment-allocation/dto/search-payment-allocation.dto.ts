import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchPaymentAllocationDto extends BaseSearchDto {
  @IsOptional() @Type(() => Number) id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) payment_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) invoice_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) debt_note_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) created_by?: number;
  @IsNumber() @IsOptional() @Type(() => Number) amount?: number;
  
  @IsDateString() @IsOptional() created_at?: string;
  @IsDateString() @IsOptional() updated_at?: string;

  // Relations
  @IsString() @IsOptional() payment_code?: string;
  @IsString() @IsOptional() invoice_code?: string;
  @IsString() @IsOptional() debt_note_code?: string;
}
