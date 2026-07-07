import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RepayLoanDto {
  @IsDateString()
  @IsOptional()
  repayment_date?: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  monthly_interest_rate!: number;

  @IsString()
  @IsOptional()
  payment_method?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
