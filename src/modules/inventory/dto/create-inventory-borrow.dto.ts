import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryBorrowStatus } from '../../../entities/inventory-borrows.entity';

export class CreateInventoryBorrowItemDto {
  @IsNumber()
  @Type(() => Number)
  product_id!: number;

  @IsNumber()
  @Type(() => Number)
  batch_id!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0.0001)
  quantity!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateInventoryBorrowDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  borrower_customer_id?: number;

  @IsString()
  borrower_name!: string;

  @IsDateString()
  borrow_date!: string;

  @IsDateString()
  @IsOptional()
  expected_return_date?: string;

  @IsEnum(InventoryBorrowStatus)
  @IsOptional()
  status?: InventoryBorrowStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryBorrowItemDto)
  items!: CreateInventoryBorrowItemDto[];
}

export class SearchInventoryBorrowDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsEnum(InventoryBorrowStatus)
  @IsOptional()
  status?: InventoryBorrowStatus;
}
