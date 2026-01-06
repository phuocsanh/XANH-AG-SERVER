import { IsOptional, IsString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

/**
 * Interface cho điều kiện lọc
 */
export interface FilterConditionDto {
  field: string;
  operator: string;
  value?: any;
}

export class SearchSupplierDto extends BaseSearchDto {
  @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;

  // --- Advanced Filtering Support ---
  
  @IsOptional()
  @IsArray()
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
