import { IsNumber, IsString, IsOptional, IsDate } from 'class-validator';

export class CreateInventoryBatchDto {
  @IsNumber()
  productId: number;

  @IsOptional()
  @IsString()
  batchCode?: string;

  @IsString()
  unitCostPrice: string;

  @IsNumber()
  originalQuantity: number;

  @IsNumber()
  remainingQuantity: number;

  @IsOptional()
  @IsDate()
  expiryDate?: Date;

  @IsOptional()
  @IsNumber()
  receiptItemId?: number;
}