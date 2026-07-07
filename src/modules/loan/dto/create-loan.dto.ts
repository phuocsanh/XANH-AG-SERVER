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
  @Type(() => Number)
  @Min(0)
  monthly_interest_rate!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
