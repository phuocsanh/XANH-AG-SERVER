import { IsString, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO cho việc tạo loại sản phẩm mới
 * Chứa các thông tin cần thiết để tạo một loại sản phẩm
 */
export class CreateProductTypeDto {
  /** Tên loại sản phẩm */
  @IsString()
  typeName!: string;

  /** Mã loại sản phẩm (duy nhất) */
  @IsString()
  typeCode!: string;

  /** Mô tả loại sản phẩm */
  @IsOptional()
  @IsString()
  description?: string;

  /** Trạng thái hoạt động (mặc định: true) */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}