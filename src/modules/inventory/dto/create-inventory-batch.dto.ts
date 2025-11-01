import { IsNumber, IsString, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO (Data Transfer Object) dùng để tạo lô hàng tồn kho mới
 * Chứa các trường cần thiết để tạo một lô hàng tồn kho
 */
export class CreateInventoryBatchDto {
  /** ID của sản phẩm trong lô hàng (bắt buộc) */
  @IsNumber()
  product_id!: number;

  /** Mã lô hàng (tùy chọn) */
  @IsOptional()
  @IsString()
  code?: string;

  /** Giá vốn đơn vị của sản phẩm trong lô hàng (bắt buộc) */
  @IsString()
  unit_cost_price!: string;

  /** Số lượng ban đầu của lô hàng (bắt buộc) */
  @IsNumber()
  original_quantity!: number;

  /** Số lượng còn lại của lô hàng (bắt buộc) */
  @IsNumber()
  remaining_quantity!: number;

  /** Ngày hết hạn của lô hàng (tùy chọn) */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiry_date?: Date;

  /** Ngày sản xuất của lô hàng (tùy chọn) */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  manufacturing_date?: Date;

  /** ID nhà cung cấp (tùy chọn) */
  @IsOptional()
  @IsNumber()
  supplier_id?: number;

  /** Ghi chú về lô hàng (tùy chọn) */
  @IsOptional()
  @IsString()
  notes?: string;

  /** ID của item phiếu nhập kho tương ứng (tùy chọn) */
  @IsOptional()
  @IsNumber()
  receipt_item_id?: number;
}
