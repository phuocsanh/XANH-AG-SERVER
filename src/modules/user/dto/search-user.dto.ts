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

export class SearchUserDto extends BaseSearchDto {
  /**
   * Filter theo tài khoản
   */
  @IsString()
  @IsOptional()
  account?: string;

  /**
   * Filter theo họ tên
   */
  @IsString()
  @IsOptional()
  full_name?: string;

  /**
   * Filter theo vai trò
   */
  @IsString()
  @IsOptional()
  role?: string;

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
  @Type(() => SearchUserDto)
  nested_filters?: SearchUserDto[];
}
