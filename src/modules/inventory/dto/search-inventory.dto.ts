import {
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FilterConditionDto } from '../../supplier/dto/filter-condition.dto'; // Giữ nguyên import cũ nếu muốn an toàn, hoặc đổi sang common
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchInventoryDto extends BaseSearchDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  product_id?: number;

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
  @Type(() => SearchInventoryDto)
  nested_filters?: SearchInventoryDto[];
}
