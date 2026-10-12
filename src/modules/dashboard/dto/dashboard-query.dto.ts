import {
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export enum DashboardPeriod {
  ALL = 'all',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

export class DashboardQueryDto extends BaseSearchDto {
  @IsEnum(DashboardPeriod)
  @IsOptional()
  period?: DashboardPeriod = DashboardPeriod.MONTH;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  year?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  month?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(4)
  quarter?: number;

  @IsDateString()
  @IsOptional()
  override start_date?: string;

  @IsDateString()
  @IsOptional()
  override end_date?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  compare_year?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  override limit?: number = 10;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  season_id?: number;
}
