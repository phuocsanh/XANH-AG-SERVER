import { IsNumber, IsString, IsOptional, IsDateString, IsIn, Min } from 'class-validator';

/**
 * DTO để tạo hoàn tiền mới cho phiếu trả hàng
 */
export class CreateRefundDto {
  /** Số tiền hoàn */
  @IsNumber()
  @Min(0, { message: 'Số tiền hoàn phải lớn hơn 0' })
  amount!: number;

  /** Phương thức hoàn tiền */
  @IsString()
  @IsIn(['cash', 'transfer', 'debt_offset'], { message: 'Phương thức hoàn tiền không hợp lệ' })
  refund_method!: string;

  /** Ngày hoàn tiền (tùy chọn, mặc định là ngày hiện tại) */
  @IsOptional()
  @IsDateString({}, { message: 'Ngày hoàn tiền không hợp lệ' })
  refund_date?: Date;

  /** Ghi chú về hoàn tiền */
  @IsOptional()
  @IsString()
  notes?: string;
}
