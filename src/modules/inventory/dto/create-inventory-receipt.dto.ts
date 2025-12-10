import {
  IsNumber,
  IsString,
  IsOptional,
  ValidateNested,
  IsArray,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO (Data Transfer Object) dùng để tạo chi tiết phiếu nhập kho
 * Chứa các trường cần thiết để tạo một chi tiết phiếu nhập kho
 */
export class CreateInventoryReceiptItemDto {
  /** ID của sản phẩm (bắt buộc) */
  @IsNumber()
  product_id!: number;

  /** Số lượng sản phẩm trong phiếu (bắt buộc) */
  @IsNumber()
  quantity!: number;

  /** Giá vốn đơn vị của sản phẩm (bắt buộc) */
  @IsNumber()
  unit_cost!: number;

  /** Tổng giá tiền của sản phẩm (bắt buộc) */
  @IsNumber()
  total_price!: number;

  /** Ghi chú về chi tiết phiếu nhập kho (tùy chọn) */
  @IsString()
  @IsOptional()
  notes?: string;

  /** Phí vận chuyển riêng cho sản phẩm này (tùy chọn) */
  @IsOptional()
  @IsNumber()
  individual_shipping_cost?: number;
}

/**
 * DTO (Data Transfer Object) dùng để tạo phiếu nhập kho mới
 * Chứa các trường cần thiết để tạo một phiếu nhập kho cùng với các chi tiết
 */
export class CreateInventoryReceiptDto {
  /** Mã phiếu nhập kho (bắt buộc) */
  @IsString()
  receipt_code!: string;

  /** ID của nhà cung cấp (bắt buộc) */
  @IsNumber()
  supplier_id!: number;

  /** Tổng số tiền của phiếu nhập kho (bắt buộc) */
  @IsNumber()
  total_amount!: number;

  /** Ghi chú về phiếu nhập kho (tùy chọn) */
  @IsString()
  @IsOptional()
  notes?: string;

  /** Trạng thái phiếu nhập kho (draft, approved, completed, cancelled) (bắt buộc) */
  @IsString()
  @IsIn(['draft', 'approved', 'completed', 'cancelled'], {
    message: 'Trạng thái không hợp lệ. Chỉ chấp nhận: draft, approved, completed, cancelled',
  })
  status!: string;

  /** ID của người tạo phiếu nhập kho (bắt buộc) */
  @IsNumber()
  created_by!: number;

  /** Phí vận chuyển chung cho toàn bộ phiếu nhập (tùy chọn) */
  @IsOptional()
  @IsNumber()
  shared_shipping_cost?: number;

  /** Phương thức phân bổ phí vận chuyển chung (by_value hoặc by_quantity) (tùy chọn) */
  @IsOptional()
  @IsString()
  shipping_allocation_method?: 'by_value' | 'by_quantity';

  /** Các chi tiết sản phẩm trong phiếu nhập kho (bắt buộc) */
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryReceiptItemDto)
  @IsArray()
  items!: CreateInventoryReceiptItemDto[];
}
