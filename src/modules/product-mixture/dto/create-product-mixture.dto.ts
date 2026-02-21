import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class CreateMixtureItemDto {
  @IsNotEmpty()
  @IsNumber()
  productId!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

export class CreateProductMixtureDto {
  @IsNotEmpty()
  @IsNumber()
  productId!: number; // Sản phẩm D

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  quantity!: number; // Số lượng D tạo ra

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMixtureItemDto)
  @IsOptional()
  items?: CreateMixtureItemDto[]; // Nếu muốn ghi đè công thức mặc định
}
