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

export class SearchUnitDto extends BaseSearchDto {
  @IsString()
  @IsOptional()
  name?: string;

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
  @Type(() => SearchUnitDto)
  nested_filters?: SearchUnitDto[];
}
