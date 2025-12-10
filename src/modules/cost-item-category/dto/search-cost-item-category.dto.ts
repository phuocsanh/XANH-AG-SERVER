import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

/**
 * DTO để tìm kiếm loại chi phí canh tác
 * Extends BaseSearchDto để có sẵn page, limit, keyword, sort, etc.
 */
export class SearchCostItemCategoryDto extends BaseSearchDto {
  /** Lọc theo mã */
  @IsOptional()
  @IsString()
  code?: string;

  /** Lọc theo tên */
  @IsOptional()
  @IsString()
  name?: string;

  /** Lọc theo trạng thái */
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
