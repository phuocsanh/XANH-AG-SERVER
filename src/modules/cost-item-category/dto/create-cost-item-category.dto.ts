import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

/**
 * DTO để tạo loại chi phí canh tác mới
 */
export class CreateCostItemCategoryDto {
  /** Mã loại chi phí (unique) */
  @IsString()
  @MaxLength(50)
  code!: string;

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
