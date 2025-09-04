import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO (Data Transfer Object) dùng để tạo chi tiết hóa đơn bán hàng
 * Chứa các trường cần thiết để tạo một chi tiết hóa đơn bán hàng
 */
class CreateSalesInvoiceItemDto {
  /** ID của sản phẩm (bắt buộc) */
  @IsNumber()
  productId!: number;

  /** Số lượng sản phẩm trong hóa đơn (bắt buộc) */
  @IsNumber()
  quantity!: number;

  /** Giá đơn vị của sản phẩm (bắt buộc) */
  @IsNumber()
  unitPrice!: number;

  /** Số tiền giảm giá cho sản phẩm (tùy chọn) */
  @IsNumber()
  @IsOptional()
  discountAmount?: number;

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
  invoiceCode!: string;

  /** Tên khách hàng (bắt buộc) */
  @IsString()
  customerName!: string;

  /** Số điện thoại khách hàng (tùy chọn) */
  @IsString()
  @IsOptional()
  customerPhone?: string;

  /** Email khách hàng (tùy chọn) */
  @IsString()
  @IsOptional()
  customerEmail?: string;

  /** Địa chỉ khách hàng (tùy chọn) */
  @IsString()
  @IsOptional()
  customerAddress?: string;

  /** Tổng số tiền của hóa đơn (bắt buộc) */
  @IsNumber()
  totalAmount!: number;

  /** Số tiền giảm giá (tùy chọn) */
  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  /** Số tiền cuối cùng sau khi giảm giá (bắt buộc) */
  @IsNumber()
  finalAmount!: number;

  /** Phương thức thanh toán (bắt buộc) */
  @IsString()
  paymentMethod!: string;

  /** Ghi chú về hóa đơn (tùy chọn) */
  @IsString()
  @IsOptional()
  notes?: string;

  /** Mảng chi tiết hóa đơn bán hàng (bắt buộc) */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesInvoiceItemDto)
  items!: CreateSalesInvoiceItemDto[];
}
