
import {
  IsNumber,
  IsString,
  IsOptional,
  ValidateNested,
  IsArray,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReceiptStatus } from '../enums/receipt-status.enum';

/**
 * DTO (Data Transfer Object) dùng để tạo chi tiết phiếu nhập kho
 */
export class CreateInventoryReceiptItemDto {
  @IsNumber()
  product_id!: number;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unit_cost!: number;

  @IsOptional()
  @IsNumber()
  vat_unit_cost?: number;

  @IsNumber()
  total_price!: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  unit_name?: string;

  @IsOptional()
  @IsNumber()
  individual_shipping_cost?: number;

  // ===== TRƯỜNG MỚI - HẠN DÙNG =====
  @IsOptional()
  @IsString()
  expiry_date?: string; // Format: YYYY-MM-DD

  @IsOptional()
  @IsString()
  manufacturing_date?: string; // Format: YYYY-MM-DD
  @IsOptional()
  @IsString()
  batch_number?: string;

  @IsOptional()
  @IsNumber()
  taxable_quantity?: number;

  // ===== QUY ĐỔI ĐƠN VỊ TÍNH =====

  /** ID đơn vị nhập kho (ví dụ: BAO) - để hiển thị trên phiếu */
  @IsOptional()
  @IsNumber()
  unit_id?: number;

  /**
   * Hệ số quy đổi về đơn vị cơ sở. Mặc định = 1.
   * Ví dụ: nhập BAO (50kg) thì conversion_factor = 50.
   */
  @IsOptional()
  @IsNumber()
  conversion_factor?: number;

  /**
   * Số lượng quy về đơn vị cơ sở (để nhập kho).
   * Nếu không gửi, backend tự tính: base_quantity = quantity × conversion_factor.
   */
  @IsOptional()
  @IsNumber()
  base_quantity?: number;
}

export class CreateInventoryReceiptDto {
  @IsString()
  @IsOptional()
  receipt_code?: string;

  @IsNumber()
  supplier_id!: number;

  @IsNumber()
  total_amount!: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  bill_date?: string; // Format: YYYY-MM-DD

  @IsString()
  @IsIn(Object.values(ReceiptStatus), {
    message: 'Trạng thái không hợp lệ',
  })
  status!: string;

  @IsOptional()
  @IsNumber()
  shared_shipping_cost?: number;

  @IsOptional()
  @IsString()
  shipping_allocation_method?: 'by_value' | 'by_quantity';



  @ValidateNested({ each: true })
  @Type(() => CreateInventoryReceiptItemDto)
  @IsArray()
  items!: CreateInventoryReceiptItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  // Các trường thanh toán
  @IsOptional()
  @IsNumber()
  paid_amount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['cash', 'transfer'], { message: 'Phương thức thanh toán không hợp lệ. Chỉ chấp nhận: cash, transfer' })
  payment_method?: string;

  @IsOptional()
  @IsString()
  payment_due_date?: string;

}
