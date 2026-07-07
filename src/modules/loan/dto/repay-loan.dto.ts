import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RepayLoanDto {
  @IsDateString()
  @IsOptional()
  repayment_date?: string;

  @IsString()
  @IsOptional()
  payment_method?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
