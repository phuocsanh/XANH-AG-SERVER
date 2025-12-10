import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

/**
 * DTO để tìm kiếm loại chi phí vận hành
 * Extends BaseSearchDto để có sẵn page, limit, keyword, sort, etc.
 */
export class SearchOperatingCostCategoryDto extends BaseSearchDto {
  /** Lọc theo mã */
  @IsOptional()
  @IsString()
  code?: string;

  /** Lọc theo tên */
  @IsOptional()
  @IsString()
  name?: string;

  /** Lọc theo trạng thái kích hoạt */
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
