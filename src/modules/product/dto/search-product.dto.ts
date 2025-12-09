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

export class SearchProductDto extends BaseSearchDto {
  /**
   * Filter theo mã sản phẩm
   */
  @IsString()
  @IsOptional()
  code?: string;

  /**
   * Filter theo tên sản phẩm
   */
  @IsString()
  @IsOptional()
  name?: string;

  /**
   * Filter theo danh mục (product_type_id)
   */
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  product_type_id?: number;

  /**
   * Filter theo danh mục con (product_subtype_id)
   */
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  product_subtype_id?: number;

  /**
   * Filter theo nhà cung cấp
   */
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  supplier_id?: number;

  /**
   * Filter theo trạng thái
   */
  @IsString()
  @IsOptional()
  status?: string;

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
  @Type(() => SearchProductDto)
  nested_filters?: SearchProductDto[];
}
