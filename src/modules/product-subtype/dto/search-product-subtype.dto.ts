import { IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { FilterConditionDto } from './filter-condition.dto';

export class SearchProductSubtypeDto {
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
  @Type(() => SearchProductSubtypeDto)
  nestedFilters?: SearchProductSubtypeDto[];
}
