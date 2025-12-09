import { IsNumber, IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { FilterConditionDto } from '../../payment/dto/filter-condition.dto';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchPaymentAllocationDto extends BaseSearchDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  payment_id?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  invoice_id?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  debt_note_id?: number;

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
  @Type(() => SearchPaymentAllocationDto)
  nested_filters?: SearchPaymentAllocationDto[];
}
