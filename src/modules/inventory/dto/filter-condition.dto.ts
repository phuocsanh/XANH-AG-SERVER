import { IsOptional, IsString, IsEnum } from 'class-validator';

export class FilterConditionDto {
  @IsOptional()
  @IsString()
  field?: string;

  @IsOptional()
  @IsString()
  @IsEnum([
    'eq',
    'ne',
    'gt',
    'lt',
    'gte',
    'lte',
    'like',
    'ilike',
    'in',
    'notin',
    'isnull',
    'isnotnull',
  ])
  operator?: string;

  @IsOptional()
  value?: any;
}
