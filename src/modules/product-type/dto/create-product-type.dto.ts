import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProductTypeStatus } from '../../../entities/product-types.entity';

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

  /** Trạng thái của loại sản phẩm (mặc định: active) */
  @IsOptional()
  @IsEnum(ProductTypeStatus)
  status?: ProductTypeStatus;
}