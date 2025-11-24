import { IsString, IsOptional, IsEnum } from 'class-validator';

export class FilterConditionDto {
  @IsString()
  field!: string;

  @IsString()
  @IsEnum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike', 'in', 'notin', 'isnull', 'isnotnull'])
  operator!: string;

  @IsOptional()
  value?: any;
}
