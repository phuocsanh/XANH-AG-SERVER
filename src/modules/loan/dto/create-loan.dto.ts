import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLoanDto {
  @IsNumber()
  @Type(() => Number)
  customer_id!: number;

  @IsDateString()
  loan_date!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  principal_amount!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  monthly_interest_rate?: number; // Lãi suất hàng tháng (tùy chọn)

  @IsString()
  @IsOptional()
  notes?: string;
}
