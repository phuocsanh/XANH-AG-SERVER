import {
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FilterConditionDto } from './filter-condition.dto';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchSalesDto extends BaseSearchDto {
  /**
   * Filter theo mã hóa đơn
   */
  @IsString()
  @IsOptional()
  code?: string;

  /**
   * Filter theo khách hàng
   */
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  customer_id?: number;

  /**
   * Filter theo mùa vụ
   */
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  season_id?: number;

  /**
   * Filter theo người tạo
   */
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  created_by?: number;

  /**
   * Filter theo trạng thái thanh toán
   */
  @IsString()
  @IsOptional()
  payment_status?: string;

  // --- Backward Compatibility & Complex Filters ---

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterConditionDto)
  filters?: FilterConditionDto[];

  @IsOptional()
  @IsEnum(['AND', 'OR', 'MUST', 'SHOULD', 'MUST_NOT'])
  operator?: 'AND' | 'OR' | 'MUST' | 'SHOULD' | 'MUST_NOT' = 'AND';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SearchSalesDto)
  nested_filters?: SearchSalesDto[];
}
