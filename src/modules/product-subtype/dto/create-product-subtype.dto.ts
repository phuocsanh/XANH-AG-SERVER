import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean } from 'class-validator';

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

  /** Trạng thái hoạt động (tùy chọn, mặc định là true) */
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean' })
  isActive?: boolean;
}