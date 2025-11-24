import { IsOptional, IsInt } from 'class-validator';
import { FilterConditionDto } from '../../sales/dto/filter-condition.dto';

export class SearchSeasonDto {
  @IsOptional()
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @IsInt()
  limit?: number = 20;

  @IsOptional()
  filters?: FilterConditionDto[];
}
