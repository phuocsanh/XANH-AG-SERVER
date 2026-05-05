import { IsNumber, IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesReturnItemDto {
  @IsNumber()
  @IsOptional()
  sales_invoice_item_id?: number;

  @IsNumber()
  @IsNotEmpty()
  product_id!: number;

  @IsNumber()
  @IsNotEmpty()
  quantity!: number;
  
  @IsString()
  @IsOptional()
  unit_name?: string;

  @IsNumber()
  @IsOptional()
  sale_unit_id?: number;

  @IsNumber()
  @IsOptional()
  conversion_factor?: number;

  // Unit price will be fetched from original invoice ideally, but can be passed for now
  @IsNumber()
  @IsNotEmpty()
  unit_price!: number;
}

export class CreateSalesReturnDto {
  @IsString()
  @IsOptional()
  code?: string; // Optional - Backend sẽ tự động sinh nếu không có

  @IsNumber()
  @IsNotEmpty()
  invoice_id!: number;

  @IsString()
  @IsOptional()
  refund_method?: string; // 'cash' hoặc 'debt_credit', mặc định 'debt_credit'

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnItemDto)
  items!: CreateSalesReturnItemDto[];
}
