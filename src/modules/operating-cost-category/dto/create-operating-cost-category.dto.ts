import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

/**
 * DTO để tạo loại chi phí vận hành mới
 */
export class CreateOperatingCostCategoryDto {
  /** Mã loại chi phí (unique) - tự động generate nếu không cung cấp */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  /** Tên loại chi phí */
  @IsString()
  @MaxLength(255)
  name!: string;

  /** Mô tả */
  @IsOptional()
  @IsString()
  description?: string;

  /** Trạng thái kích hoạt */
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
