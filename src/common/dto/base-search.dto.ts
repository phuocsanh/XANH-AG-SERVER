import { IsNumber, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class BaseSearchDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 10;

  @IsString()
  @IsOptional()
  keyword?: string; // Từ khóa tìm kiếm chung

  @IsString()
  @IsOptional()
  sort?: string; // Format: "field:DESC"

  @IsString()
  @IsOptional()
  sort_by?: string;

  @IsEnum(SortOrder)
  @IsOptional()
  sort_order?: SortOrder;
}
