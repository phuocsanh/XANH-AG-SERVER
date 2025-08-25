import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateInventoryReceiptItemDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitCost: number;

  @IsNumber()
  totalPrice: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateInventoryReceiptDto {
  @IsString()
  receiptCode: string;

  @IsString()
  @IsOptional()
  supplierName?: string;

  @IsString()
  @IsOptional()
  supplierContact?: string;

  @IsNumber()
  totalAmount: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  status: string; // draft, approved, completed, cancelled

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryReceiptItemDto)
  items: CreateInventoryReceiptItemDto[];
}
