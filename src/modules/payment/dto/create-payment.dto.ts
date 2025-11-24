import { IsString, IsNumber, IsDateString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsNumber()
  @IsNotEmpty()
  customer_id!: number;

  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @IsDateString()
  @IsNotEmpty()
  payment_date!: string;

  @IsString()
  @IsNotEmpty()
  payment_method!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
