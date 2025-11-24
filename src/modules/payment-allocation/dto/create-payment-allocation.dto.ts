import { IsNumber, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';

export class CreatePaymentAllocationDto {
  @IsNumber()
  @IsNotEmpty()
  payment_id!: number;

  @IsEnum(['invoice', 'debt_note'])
  @IsNotEmpty()
  allocation_type!: 'invoice' | 'debt_note';

  @IsNumber()
  @IsOptional()
  invoice_id?: number;

  @IsNumber()
  @IsOptional()
  debt_note_id?: number;

  @IsNumber()
  @IsNotEmpty()
  amount!: number;
}
