import { IsString, IsNumber, IsOptional, IsNotEmpty, IsDateString, IsArray } from 'class-validator';

export class CreateDebtNoteDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsNumber()
  @IsNotEmpty()
  customer_id!: number;

  @IsNumber()
  @IsOptional()
  season_id?: number;

  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @IsDateString()
  @IsOptional()
  due_date?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsOptional()
  source_invoices?: number[];
}
