import { IsNumber, IsString, IsOptional } from 'class-validator';

/**
 * DTO (Data Transfer Object) dùng để tạo giao dịch kho mới
 * Chứa các trường cần thiết để tạo một giao dịch kho
 */
export class CreateInventoryTransactionDto {
  /** ID của sản phẩm trong giao dịch (bắt buộc) */
  @IsNumber()
  productId: number;

  /** Loại giao dịch (ví dụ: 'IN' cho nhập kho, 'OUT' cho xuất kho) (bắt buộc) */
  @IsString()
  transactionType: string;

  /** Số lượng trong giao dịch (bắt buộc) */
  @IsNumber()
  quantity: number;

  /** Giá vốn đơn vị của sản phẩm trong giao dịch (bắt buộc) */
  @IsString()
  unitCostPrice: string;

  /** Tổng giá trị chi phí của giao dịch (bắt buộc) */
  @IsString()
  totalCostValue: string;

  /** Số lượng còn lại sau giao dịch (bắt buộc) */
  @IsNumber()
  remainingQuantity: number;

  /** Giá vốn trung bình mới sau giao dịch (bắt buộc) */
  @IsString()
  newAverageCost: string;

  /** ID của item phiếu nhập kho tương ứng (tùy chọn) */
  @IsOptional()
  @IsNumber()
  receiptItemId?: number;

  /** Loại tham chiếu (ví dụ: 'SALE' cho bán hàng, 'ADJUSTMENT' cho điều chỉnh) (tùy chọn) */
  @IsOptional()
  @IsString()
  referenceType?: string;

  /** ID của tham chiếu (ví dụ: ID hóa đơn bán hàng) (tùy chọn) */
  @IsOptional()
  @IsNumber()
  referenceId?: number;

  /** Ghi chú về giao dịch (tùy chọn) */
  @IsOptional()
  @IsString()
  notes?: string;

  /** ID của người dùng tạo giao dịch (bắt buộc) */
  @IsNumber()
  createdByUserId: number;
}