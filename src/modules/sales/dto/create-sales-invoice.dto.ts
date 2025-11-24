import { IsNumber, IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO (Data Transfer Object) dùng để tạo chi tiết hóa đơn bán hàng
 * Chứa các trường cần thiết để tạo một chi tiết hóa đơn bán hàng
 */
export class CreateSalesInvoiceItemDto {
  /** ID của sản phẩm (bắt buộc) */
  @IsNumber()
  product_id!: number;

  /** Số lượng sản phẩm trong hóa đơn (bắt buộc) */
  @IsNumber()
  quantity!: number;

  /** Giá đơn vị của sản phẩm (bắt buộc) */
  @IsNumber()
  unit_price!: number;

  /** Số tiền giảm giá cho sản phẩm (tùy chọn) */
  @IsNumber()
  @IsOptional()
  discount_amount?: number;

  /** Ghi chú về chi tiết hóa đơn (tùy chọn) */
  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * DTO (Data Transfer Object) dùng để tạo hóa đơn bán hàng mới
 * Chứa các trường cần thiết để tạo một hóa đơn bán hàng cùng với các chi tiết
 */
export class CreateSalesInvoiceDto {
  /** Mã hóa đơn bán hàng (bắt buộc) */
  @IsString()
  invoice_code!: string;

  /** Tên khách hàng (bắt buộc) */
  @IsString()
  customer_name!: string;

  /** Số điện thoại khách hàng (tùy chọn) */
  @IsString()
  @IsOptional()
  customer_phone?: string;

  /** Email khách hàng (tùy chọn) */
  @IsString()
  @IsOptional()
  customer_email?: string;

  /** Địa chỉ khách hàng (tùy chọn) */
  @IsString()
  @IsOptional()
  customer_address?: string;

  /** Tổng số tiền của hóa đơn (bắt buộc) */
  @IsNumber()
  total_amount!: number;

  /** Số tiền giảm giá (tùy chọn) */
  @IsNumber()
  @IsOptional()
  discount_amount?: number;

  /** Số tiền cuối cùng sau khi giảm giá (bắt buộc) */
  @IsNumber()
  final_amount!: number;

  /** Phương thức thanh toán (bắt buộc) */
  @IsString()
  payment_method!: string;

  /** Ghi chú về hóa đơn (tùy chọn) */
  @IsString()
  @IsOptional()
  notes?: string;

  /** Lưu ý quan trọng về hóa đơn (tùy chọn) */
  @IsString()
  @IsOptional()
  warning?: string;

  /** Số tiền đã thanh toán (cho trường hợp bán thiếu, tùy chọn) */
  @IsNumber()
  @IsOptional()
  partial_payment_amount?: number;

  /** Các chi tiết hóa đơn (bắt buộc) */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesInvoiceItemDto)
  items!: CreateSalesInvoiceItemDto[];
}
