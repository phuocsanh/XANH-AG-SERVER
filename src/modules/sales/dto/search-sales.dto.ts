import {
  IsOptional,
  IsNumber,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchSalesDto extends BaseSearchDto {
  // --- Core Fields ---
  @IsOptional()
  @Type(() => Number)
  id?: number;

  @IsString()
  @IsOptional()
  code?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  customer_id?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  season_id?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  rice_crop_id?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  created_by?: number;

  // --- Amount Fields ---
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  total_amount?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  discount_amount?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  final_amount?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  paid_amount?: number; // partial_payment_amount ?

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  remaining_amount?: number;

  // --- Status & Dates ---
  @IsString()
  @IsOptional()
  sale_date?: string;

  @IsString()
  @IsOptional()
  sale_date_start?: string;

  @IsString()
  @IsOptional()
  sale_date_end?: string;

  @IsString()
  @IsOptional()
  payment_status?: string | string[]; // Hỗ trợ filter nhiều payment_status

  @IsOptional()
  status?: string | string[]; // Hỗ trợ filter nhiều status: "confirmed" hoặc ["confirmed", "paid"]

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  created_at?: string;

  @IsDateString()
  @IsOptional()
  updated_at?: string;

  // --- Relation Flat Fields ---
  @IsString()
  @IsOptional()
  customer_name?: string;

  @IsString()
  @IsOptional()
  customer_phone?: string;

  @IsString()
  @IsOptional()
  season_name?: string;

  @IsString()
  @IsOptional()
  rice_crop_name?: string;
}
