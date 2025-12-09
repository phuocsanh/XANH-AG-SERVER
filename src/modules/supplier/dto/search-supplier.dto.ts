import {
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FilterConditionDto } from './filter-condition.dto';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchSupplierDto extends BaseSearchDto {
  /**
   * Filter theo mã nhà cung cấp
   */
  @IsString()
  @IsOptional()
  code?: string;

  /**
   * Filter theo tên nhà cung cấp
   */
  @IsString()
  @IsOptional()
  name?: string;

  /**
   * Filter theo số điện thoại
   */
  @IsString()
  @IsOptional()
  phone?: string;

  /**
   * Filter theo trạng thái
   */
  @IsString()
  @IsOptional()
  status?: string;

  // --- Backward Compatibility ---

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
  @Type(() => SearchSupplierDto)
  nested_filters?: SearchSupplierDto[];
}
