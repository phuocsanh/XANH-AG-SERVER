import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchDebtNoteDto extends BaseSearchDto {
  // --- Entity Fields ---
  @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() code?: string;
  @IsNumber() @IsOptional() @Type(() => Number) customer_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) season_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) created_by?: number;
  
  @IsNumber() @IsOptional() @Type(() => Number) total_amount?: number;
  @IsNumber() @IsOptional() @Type(() => Number) paid_amount?: number;
  @IsNumber() @IsOptional() @Type(() => Number) remaining_amount?: number;

  @IsString() @IsOptional() status?: string;
  @IsDateString() @IsOptional() created_at?: string;
  @IsDateString() @IsOptional() updated_at?: string;

  // --- Relations Flat Fields ---
  @IsString() @IsOptional() customer_name?: string;
  @IsString() @IsOptional() customer_phone?: string;
  @IsString() @IsOptional() season_name?: string;
}
