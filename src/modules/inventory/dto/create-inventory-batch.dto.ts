import { IsNumber, IsString, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO (Data Transfer Object) dùng để tạo lô hàng tồn kho mới
 * Chứa các trường cần thiết để tạo một lô hàng tồn kho
 */
export class CreateInventoryBatchDto {
  /** ID của sản phẩm trong lô hàng (bắt buộc) */
  @IsNumber()
  productId!: number;

  /** Mã lô hàng (tùy chọn) */
  @IsOptional()
  @IsString()
  batchCode?: string;

  /** Giá vốn đơn vị của sản phẩm trong lô hàng (bắt buộc) */
  @IsString()
  unitCostPrice!: string;

  /** Số lượng ban đầu của lô hàng (bắt buộc) */
  @IsNumber()
  originalQuantity!: number;

  /** Số lượng còn lại của lô hàng (bắt buộc) */
  @IsNumber()
  remainingQuantity!: number;

  /** Ngày hết hạn của lô hàng (tùy chọn) */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiryDate?: Date;

  /** Ngày sản xuất của lô hàng (tùy chọn) */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  manufacturingDate?: Date;

  /** ID nhà cung cấp (tùy chọn) */
  @IsOptional()
  @IsNumber()
  supplierId?: number;

  /** Ghi chú về lô hàng (tùy chọn) */
  @IsOptional()
  @IsString()
  notes?: string;

  /** ID của item phiếu nhập kho tương ứng (tùy chọn) */
  @IsOptional()
  @IsNumber()
  receiptItemId?: number;
}