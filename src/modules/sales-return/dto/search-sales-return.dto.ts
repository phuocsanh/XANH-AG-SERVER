import { IsNumber, IsOptional, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { FilterConditionDto } from '../../payment/dto/filter-condition.dto';

export class SearchSalesReturnDto {
  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterConditionDto)
  filters?: FilterConditionDto[];

  @IsString()
  @IsOptional()
  operator?: 'AND' | 'OR';
}
