import { IsNumber, IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesReturnItemDto {
  @IsNumber()
  @IsNotEmpty()
  product_id!: number;

  @IsNumber()
  @IsNotEmpty()
  quantity!: number;
  
  // Unit price will be fetched from original invoice ideally, but can be passed for now
  @IsNumber()
  @IsNotEmpty()
  unit_price!: number;
}

export class CreateSalesReturnDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsNumber()
  @IsNotEmpty()
  invoice_id!: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnItemDto)
  items!: CreateSalesReturnItemDto[];
}
