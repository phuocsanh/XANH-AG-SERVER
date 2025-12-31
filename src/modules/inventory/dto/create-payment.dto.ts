import { IsNumber, IsString, IsOptional, IsDateString, IsIn, Min } from 'class-validator';

/**
 * DTO để tạo thanh toán mới cho phiếu nhập kho
 */
export class CreatePaymentDto {
  /** Số tiền thanh toán */
  @IsNumber()
  @Min(0, { message: 'Số tiền thanh toán phải lớn hơn 0' })
  amount!: number;

  /** Phương thức thanh toán */
  @IsString()
  @IsIn(['cash', 'transfer'], { message: 'Phương thức thanh toán không hợp lệ' })
  payment_method!: string;

  /** Ngày thanh toán (tùy chọn, mặc định là ngày hiện tại) */
  @IsOptional()
  @IsDateString({}, { message: 'Ngày thanh toán không hợp lệ' })
  payment_date?: Date;

  /** Ghi chú về thanh toán */
  @IsOptional()
  @IsString()
  notes?: string;
}
