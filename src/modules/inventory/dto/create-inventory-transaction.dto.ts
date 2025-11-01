import { IsNumber, IsString, IsOptional } from 'class-validator';

/**
 * DTO (Data Transfer Object) dùng để tạo giao dịch kho mới
 * Chứa các trường cần thiết để tạo một giao dịch kho
 */
export class CreateInventoryTransactionDto {
  /** ID của sản phẩm trong giao dịch (bắt buộc) */
  @IsNumber()
  product_id!: number;

  /** Loại giao dịch (ví dụ: 'IN' cho nhập kho, 'OUT' cho xuất kho) (bắt buộc) */
  @IsString()
  transaction_type!: string;

  /** Số lượng trong giao dịch (bắt buộc) */
  @IsNumber()
  quantity!: number;

  /** Giá vốn đơn vị của sản phẩm trong giao dịch (bắt buộc) */
  @IsString()
  unit_cost_price!: string;

  /** Tổng giá trị chi phí của giao dịch (bắt buộc) */
  @IsString()
  total_cost_value!: string;

  /** Số lượng còn lại sau giao dịch (bắt buộc) */
  @IsNumber()
  remaining_quantity!: number;

  /** Giá vốn trung bình mới sau giao dịch (bắt buộc) */
  @IsString()
  new_average_cost!: string;

  /** ID của item phiếu nhập kho tương ứng (tùy chọn) */
  @IsOptional()
  @IsNumber()
  receipt_item_id?: number;

  /** Loại tham chiếu (ví dụ: 'SALE' cho bán hàng, 'ADJUSTMENT' cho điều chỉnh) (tùy chọn) */
  @IsOptional()
  @IsString()
  reference_type?: string;

  /** ID của tham chiếu (ví dụ: ID hóa đơn bán hàng) (tùy chọn) */
  @IsOptional()
  @IsNumber()
  reference_id?: number;

  /** Ghi chú về giao dịch (tùy chọn) */
  @IsOptional()
  @IsString()
  notes?: string;

  /** ID của người dùng tạo giao dịch (bắt buộc) */
  @IsNumber()
  created_by_user_id!: number;
}
