import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

/**
 * DTO để tìm kiếm loại chi phí canh tác
 */
export class SearchCostItemCategoryDto {
  /** Trang hiện tại */
  @IsOptional()
  @IsNumber()
  page?: number;

  /** Số lượng items mỗi trang */
  @IsOptional()
  @IsNumber()
  limit?: number;

  /** Từ khóa tìm kiếm */
  @IsOptional()
  @IsString()
  keyword?: string;

  /** Lọc theo trạng thái */
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  /** Sắp xếp */
  @IsOptional()
  @IsString()
  sort?: string;
}
