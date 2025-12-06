import { IsString, IsNumber, IsDateString, IsOptional, IsNotEmpty } from 'class-validator';

/**
 * DTO cho chức năng chốt sổ công nợ
 */
export class SettleDebtDto {
  /** ID khách hàng */
  @IsNumber()
  @IsNotEmpty()
  customer_id!: number;

  /** ID mùa vụ cần chốt sổ */
  @IsNumber()
  @IsNotEmpty()
  season_id!: number;

  /** Số tiền khách trả */
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  /** Phương thức thanh toán (cash, transfer, etc.) */
  @IsString()
  @IsNotEmpty()
  payment_method!: string;

  /** Ngày thanh toán (mặc định: ngày hiện tại) */
  @IsDateString()
  @IsOptional()
  payment_date?: string;

  /** Ghi chú */
  @IsString()
  @IsOptional()
  notes?: string;
}
