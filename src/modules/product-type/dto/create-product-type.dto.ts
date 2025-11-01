import { IsString, IsOptional, IsEnum } from 'class-validator';
import { BaseStatus } from '../../../entities/base-status.enum';

/**
 * DTO cho việc tạo loại sản phẩm mới
 * Chứa các thông tin cần thiết để tạo một loại sản phẩm
 */
export class CreateProductTypeDto {
  /** Tên loại sản phẩm */
  @IsString()
  name!: string;

  /** Mã loại sản phẩm (duy nhất) */
  @IsString()
  code!: string;

  /** Mô tả loại sản phẩm */
  @IsOptional()
  @IsString()
  description?: string;

  /** Trạng thái của loại sản phẩm (mặc định: active) */
  @IsOptional()
  @IsEnum(BaseStatus)
  status?: BaseStatus;
}
