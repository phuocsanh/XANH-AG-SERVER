import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO (Data Transfer Object) dùng để tạo chi tiết phiếu nhập kho
 * Chứa các trường cần thiết để tạo một chi tiết phiếu nhập kho
 */
class CreateInventoryReceiptItemDto {
  /** ID của sản phẩm (bắt buộc) */
  @IsNumber()
  productId: number;

  /** Số lượng sản phẩm trong phiếu (bắt buộc) */
  @IsNumber()
  quantity: number;

  /** Giá vốn đơn vị của sản phẩm (bắt buộc) */
  @IsNumber()
  unitCost: number;

  /** Tổng giá tiền của sản phẩm (bắt buộc) */
  @IsNumber()
  totalPrice: number;

  /** Ghi chú về chi tiết phiếu nhập kho (tùy chọn) */
  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * DTO (Data Transfer Object) dùng để tạo phiếu nhập kho mới
 * Chứa các trường cần thiết để tạo một phiếu nhập kho cùng với các chi tiết
 */
export class CreateInventoryReceiptDto {
  /** Mã phiếu nhập kho (bắt buộc) */
  @IsString()
  receiptCode: string;

  /** Tên nhà cung cấp (tùy chọn) */
  @IsString()
  @IsOptional()
  supplierName?: string;

  /** Thông tin liên hệ nhà cung cấp (tùy chọn) */
  @IsString()
  @IsOptional()
  supplierContact?: string;

  /** Tổng số tiền của phiếu nhập kho (bắt buộc) */
  @IsNumber()
  totalAmount: number;

  /** Ghi chú về phiếu nhập kho (tùy chọn) */
  @IsString()
  @IsOptional()
  notes?: string;

  /** Trạng thái phiếu nhập kho (draft, approved, completed, cancelled) (bắt buộc) */
  @IsString()
  status: string;

  /** Mảng chi tiết phiếu nhập kho (bắt buộc) */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryReceiptItemDto)
  items: CreateInventoryReceiptItemDto[];
}
