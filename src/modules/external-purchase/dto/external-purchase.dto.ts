import { IsNotEmpty, IsNumber, IsString, IsDateString, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO cho item trong hóa đơn mua ngoài
 */
export class ExternalPurchaseItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  product_name!: string;

  @IsNumber()
  @Min(0.01, { message: 'Số lượng phải lớn hơn 0' })
  quantity!: number;

  @IsNumber()
  @Min(0, { message: 'Đơn giá phải lớn hơn hoặc bằng 0' })
  unit_price!: number;

  @IsNumber()
  @Min(0, { message: 'Tổng tiền phải lớn hơn hoặc bằng 0' })
  total_price!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO để tạo hóa đơn mua ngoài
 */
export class CreateExternalPurchaseDto {
  @IsNumber()
  @IsNotEmpty({ message: 'rice_crop_id không được để trống' })
  rice_crop_id!: number;

  @IsDateString()
  @IsNotEmpty({ message: 'Ngày mua không được để trống' })
  purchase_date!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên nhà cung cấp không được để trống' })
  supplier_name!: string;

  @IsNumber()
  @Min(0, { message: 'Tổng tiền phải lớn hơn hoặc bằng 0' })
  total_amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalPurchaseItemDto)
  items!: ExternalPurchaseItemDto[];
}

/**
 * DTO để cập nhật hóa đơn mua ngoài
 */
export class UpdateExternalPurchaseDto {
  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  @IsOptional()
  @IsString()
  supplier_name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalPurchaseItemDto)
  items?: ExternalPurchaseItemDto[];
}
