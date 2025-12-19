import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdjustmentStatus } from '../enums/adjustment-status.enum';

/**
 * DTO cho chi tiết sản phẩm trong phiếu điều chỉnh kho
 */
export class CreateInventoryAdjustmentItemDto {
  /** ID của sản phẩm */
  @IsNotEmpty({ message: 'ID sản phẩm không được để trống' })
  @IsNumber({}, { message: 'ID sản phẩm phải là số' })
  product_id!: number;

  /** Số lượng thay đổi (dương: tăng, âm: giảm) */
  @IsNotEmpty({ message: 'Số lượng thay đổi không được để trống' })
  @IsNumber({}, { message: 'Số lượng thay đổi phải là số' })
  quantity_change!: number;

  /** Lý do điều chỉnh cho sản phẩm này */
  @IsOptional()
  @IsString({ message: 'Lý do phải là chuỗi' })
  reason?: string;

  /** Ghi chú */
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}

/**
 * DTO cho việc tạo phiếu điều chỉnh kho mới
 */
export class CreateInventoryAdjustmentDto {
  /** Mã phiếu điều chỉnh kho */
  @IsNotEmpty({ message: 'Mã phiếu điều chỉnh kho không được để trống' })
  @IsString({ message: 'Mã phiếu điều chỉnh kho phải là chuỗi' })
  adjustment_code!: string;

  /** Loại điều chỉnh (IN hoặc OUT) */
  @IsNotEmpty({ message: 'Loại điều chỉnh không được để trống' })
  @IsString({ message: 'Loại điều chỉnh phải là chuỗi' })
  @IsIn(['IN', 'OUT'], { message: 'Loại điều chỉnh phải là IN hoặc OUT' })
  adjustment_type!: string;

  /** Lý do điều chỉnh */
  @IsNotEmpty({ message: 'Lý do điều chỉnh không được để trống' })
  @IsString({ message: 'Lý do điều chỉnh phải là chuỗi' })
  reason!: string;

  /** Trạng thái phiếu điều chỉnh kho */
  @IsOptional()
  @IsString({ message: 'Trạng thái phải là chuỗi' })
  @IsIn(Object.values(AdjustmentStatus), { message: 'Trạng thái không hợp lệ' })
  status?: string;

  /** Ghi chú */
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;

  /** ID người tạo */
  @IsNotEmpty({ message: 'ID người tạo không được để trống' })
  @IsNumber({}, { message: 'ID người tạo phải là số' })
  created_by!: number;

  /** Danh sách chi tiết sản phẩm */
  @IsNotEmpty({ message: 'Danh sách sản phẩm không được để trống' })
  @IsArray({ message: 'Danh sách sản phẩm phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryAdjustmentItemDto)
  items!: CreateInventoryAdjustmentItemDto[];

  /** Danh sách URL hình ảnh */
  @IsOptional()
  @IsArray({ message: 'Danh sách hình ảnh phải là mảng' })
  @IsString({ each: true, message: 'Mỗi hình ảnh phải là chuỗi URL' })
  images?: string[];
}
