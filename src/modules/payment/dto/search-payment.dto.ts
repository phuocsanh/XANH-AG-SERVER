import { IsNumber, IsOptional, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { FilterConditionDto } from './filter-condition.dto';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchPaymentDto extends BaseSearchDto {
  /**
   * Filter theo mã phiếu thu
   */
  @IsString()
  @IsOptional()
  code?: string;

  /**
   * Filter theo phương thức thanh toán
   */
  @IsString()
  @IsOptional()
  payment_method?: string;

  /**
   * Filter theo mã phiếu công nợ
   */
  @IsString()
  @IsOptional()
  debt_note_code?: string;

  /**
   * Filter theo ID khách hàng
   */
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  customer_id?: number;

  /**
   * Backward compatibility: Mảng filters cũ
   */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterConditionDto)
  filters?: FilterConditionDto[];

  @IsString()
  @IsOptional()
  operator?: 'AND' | 'OR';
}
