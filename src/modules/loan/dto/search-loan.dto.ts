import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchLoanDto extends BaseSearchDto {
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

  @IsString()
  @IsOptional()
  customer_name?: string;

  @IsString()
  @IsOptional()
  customer_phone?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  loan_date_start?: string;

  @IsDateString()
  @IsOptional()
  loan_date_end?: string;

  @IsDateString()
  @IsOptional()
  repayment_date_start?: string;

  @IsDateString()
  @IsOptional()
  repayment_date_end?: string;
}
