import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsNotEmpty,
  IsNumber, 
  IsString, 
  IsOptional, 
  IsDateString,
  Min 
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCostItemDto {
  @ApiProperty({ description: 'ID mảnh ruộng', example: 1 })
  @IsNotEmpty({ message: 'ID mảnh ruộng không được để trống' })
  @IsNumber({}, { message: 'ID mảnh ruộng phải là số' })
  @Type(() => Number)
  rice_crop_id!: number;
  
  @ApiPropertyOptional({ description: 'ID loại chi phí', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'ID loại chi phí phải là số' })
  @Type(() => Number)
  category_id?: number;


  @ApiProperty({ description: 'Tên khoản chi', example: 'Giống lúa OM 5451' })
  @IsNotEmpty({ message: 'Tên khoản chi không được để trống' })
  @IsString({ message: 'Tên khoản chi phải là chuỗi' })
  item_name!: string;



  @ApiProperty({ description: 'Tổng chi phí', example: 2500000 })
  @IsNotEmpty({ message: 'Tổng chi phí không được để trống' })
  @IsNumber({}, { message: 'Tổng chi phí phải là số' })
  @Min(0, { message: 'Tổng chi phí phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  total_cost!: number;

  @ApiPropertyOptional({ description: 'Ngày chi', example: '2024-12-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày chi phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  expense_date?: string;

  @ApiPropertyOptional({ description: 'ID hóa đơn', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'ID hóa đơn phải là số' })
  @Type(() => Number)
  invoice_id?: number;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}

export class UpdateCostItemDto {
  @ApiPropertyOptional({ description: 'ID loại chi phí', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'ID loại chi phí phải là số' })
  @Type(() => Number)
  category_id?: number;

  @ApiPropertyOptional({ description: 'Tên khoản chi', example: 'Giống lúa OM 5451' })
  @IsOptional()
  @IsString({ message: 'Tên khoản chi phải là chuỗi' })
  item_name?: string;



  @ApiPropertyOptional({ description: 'Tổng chi phí', example: 2500000 })
  @IsOptional()
  @IsNumber({}, { message: 'Tổng chi phí phải là số' })
  @Min(0, { message: 'Tổng chi phí phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  total_cost?: number;

  @ApiPropertyOptional({ description: 'Ngày chi', example: '2024-12-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày chi phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  expense_date?: string;

  @ApiPropertyOptional({ description: 'ID hóa đơn', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'ID hóa đơn phải là số' })
  @Type(() => Number)
  invoice_id?: number;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}

export class QueryCostItemDto {
  @ApiPropertyOptional({ description: 'ID mảnh ruộng', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'ID mảnh ruộng phải là số' })
  @Type(() => Number)
  rice_crop_id?: number;

}

/**
 * DTO để tìm kiếm chi phí (nâng cao)
 */
export class SearchCostItemDto extends QueryCostItemDto {
  @ApiPropertyOptional({ description: 'Trang hiện tại', example: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng mỗi trang', example: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 20;
}
