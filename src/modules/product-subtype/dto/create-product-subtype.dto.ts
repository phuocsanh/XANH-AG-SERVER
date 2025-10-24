import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { BaseStatus } from '../../../entities/base-status.enum';

/**
 * DTO cho việc tạo loại phụ sản phẩm mới
 * Định nghĩa cấu trúc dữ liệu và validation cho request tạo product subtype
 */
export class CreateProductSubtypeDto {
  /** Tên loại phụ sản phẩm */
  @IsString({ message: 'Tên loại phụ sản phẩm phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên loại phụ sản phẩm không được để trống' })
  subtypeName!: string;

  /** Mã loại phụ sản phẩm (duy nhất) */
  @IsString({ message: 'Mã loại phụ sản phẩm phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã loại phụ sản phẩm không được để trống' })
  subtypeCode!: string;

  /** ID loại sản phẩm mà loại phụ sản phẩm này thuộc về */
  @IsNumber({}, { message: 'ID loại sản phẩm phải là số' })
  @IsNotEmpty({ message: 'ID loại sản phẩm không được để trống' })
  productTypeId!: number;

  /** Mô tả loại phụ sản phẩm (tùy chọn) */
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  description?: string;

  /** Trạng thái của loại phụ sản phẩm (tùy chọn, mặc định là 'active') */
  @IsOptional()
  @IsEnum(BaseStatus, {
    message:
      'Trạng thái phải là một trong các giá trị: active, inactive, archived',
  })
  status?: BaseStatus;
}
