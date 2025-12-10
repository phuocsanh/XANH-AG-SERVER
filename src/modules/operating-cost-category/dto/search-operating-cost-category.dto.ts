import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

/**
 * DTO để tìm kiếm loại chi phí vận hành
 */
export class SearchOperatingCostCategoryDto {
  /** Trang hiện tại */
  @IsOptional()
  @IsNumber()
  page?: number;

  /** Số lượng items mỗi trang */
  @IsOptional()
  @IsNumber()
  limit?: number;

  /** Từ khóa tìm kiếm (tìm trong code, name) */
  @IsOptional()
  @IsString()
  keyword?: string;

  /** Lọc theo trạng thái kích hoạt */
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  /** Sắp xếp theo field:order (ví dụ: "name:ASC") */
  @IsOptional()
  @IsString()
  sort?: string;
}
