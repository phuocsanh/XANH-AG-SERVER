import { IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateInventoryTransactionDto {
  @IsNumber()
  productId: number;

  @IsString()
  transactionType: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unitCostPrice: string;

  @IsString()
  totalCostValue: string;

  @IsNumber()
  remainingQuantity: number;

  @IsString()
  newAverageCost: string;

  @IsOptional()
  @IsNumber()
  receiptItemId?: number;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsNumber()
  referenceId?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNumber()
  createdByUserId: number;
}