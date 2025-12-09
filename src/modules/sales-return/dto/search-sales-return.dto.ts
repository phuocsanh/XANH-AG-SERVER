import { IsOptional, IsArray, ValidateNested, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { FilterConditionDto } from '../../payment/dto/filter-condition.dto';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchSalesReturnDto extends BaseSearchDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  status?: string;

  // --- Backward Compatibility ---

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterConditionDto)
  filters?: FilterConditionDto[];

  @IsEnum(['AND', 'OR', 'MUST', 'SHOULD', 'MUST_NOT'])
  @IsOptional()
  operator?: 'AND' | 'OR' | 'MUST' | 'SHOULD' | 'MUST_NOT' = 'AND';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SearchSalesReturnDto)
  nested_filters?: SearchSalesReturnDto[];
}
