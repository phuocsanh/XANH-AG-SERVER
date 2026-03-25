import { IsOptional, IsString, IsNumber } from 'class-validator';

/**
 * DTO cho việc chốt sổ công nợ cuối vụ
 */
export class CloseSeasonDebtNoteDto {
  /** Mô tả quà tặng (nếu đủ điều kiện) */
  @IsOptional()
  @IsString()
  gift_description?: string;

  /** Giá trị quà tặng */
  @IsOptional()
  @IsNumber()
  gift_value?: number;

  /** Ghi chú khi chốt sổ */
  @IsOptional()
  @IsString()
  notes?: string;

  /** Số tiền thanh toán tại thời điểm chốt sổ */
  @IsOptional()
  @IsNumber()
  payment_amount?: number;

  /** Số dư tích lũy chuyển sang vụ sau (nhập thủ công) */
  @IsOptional()
  @IsNumber()
  manual_remaining_amount?: number;
}
