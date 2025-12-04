import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO cho chi tiết sản phẩm trong phiếu xuất trả hàng
 */
export class CreateInventoryReturnItemDto {
  /** ID của sản phẩm */
  @IsNotEmpty({ message: 'ID sản phẩm không được để trống' })
  @IsNumber({}, { message: 'ID sản phẩm phải là số' })
  product_id!: number;

  /** Số lượng sản phẩm trả lại */
  @IsNotEmpty({ message: 'Số lượng không được để trống' })
  @IsNumber({}, { message: 'Số lượng phải là số' })
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  quantity!: number;

  /** Giá vốn đơn vị */
  @IsNotEmpty({ message: 'Giá vốn đơn vị không được để trống' })
  @IsNumber({}, { message: 'Giá vốn đơn vị phải là số' })
  @Min(0, { message: 'Giá vốn đơn vị phải lớn hơn hoặc bằng 0' })
  unit_cost!: number;

  /** Tổng giá tiền */
  @IsNotEmpty({ message: 'Tổng giá tiền không được để trống' })
  @IsNumber({}, { message: 'Tổng giá tiền phải là số' })
  @Min(0, { message: 'Tổng giá tiền phải lớn hơn hoặc bằng 0' })
  total_price!: number;

  /** Lý do trả hàng cho sản phẩm này */
  @IsOptional()
  @IsString({ message: 'Lý do phải là chuỗi' })
  reason?: string;

  /** Ghi chú */
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}

/**
 * DTO cho việc tạo phiếu xuất trả hàng mới
 */
export class CreateInventoryReturnDto {
  /** Mã phiếu xuất trả hàng */
  @IsNotEmpty({ message: 'Mã phiếu xuất trả hàng không được để trống' })
  @IsString({ message: 'Mã phiếu xuất trả hàng phải là chuỗi' })
  return_code!: string;

  /** ID của phiếu nhập kho gốc (tùy chọn) */
  @IsOptional()
  @IsNumber({}, { message: 'ID phiếu nhập kho phải là số' })
  receipt_id?: number;

  /** ID của nhà cung cấp */
  @IsNotEmpty({ message: 'ID nhà cung cấp không được để trống' })
  @IsNumber({}, { message: 'ID nhà cung cấp phải là số' })
  supplier_id!: number;

  /** Tổng số tiền */
  @IsNotEmpty({ message: 'Tổng số tiền không được để trống' })
  @IsNumber({}, { message: 'Tổng số tiền phải là số' })
  @Min(0, { message: 'Tổng số tiền phải lớn hơn hoặc bằng 0' })
  total_amount!: number;

  /** Lý do trả hàng */
  @IsNotEmpty({ message: 'Lý do trả hàng không được để trống' })
  @IsString({ message: 'Lý do trả hàng phải là chuỗi' })
  reason!: string;

  /** Trạng thái phiếu xuất trả hàng */
  @IsOptional()
  @IsString({ message: 'Trạng thái phải là chuỗi' })
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
  @Type(() => CreateInventoryReturnItemDto)
  items!: CreateInventoryReturnItemDto[];
}
