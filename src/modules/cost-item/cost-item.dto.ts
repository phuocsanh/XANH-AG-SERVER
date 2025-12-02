import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsNotEmpty, 
  IsNumber, 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsDateString,
  Min 
} from 'class-validator';
import { Type } from 'class-transformer';
import { CostCategory } from '../../entities/cost-item.entity';

export class CreateCostItemDto {
  @ApiProperty({ description: 'ID vụ lúa', example: 1 })
  @IsNotEmpty({ message: 'ID vụ lúa không được để trống' })
  @IsNumber({}, { message: 'ID vụ lúa phải là số' })
  @Type(() => Number)
  rice_crop_id!: number;

  @ApiProperty({ 
    description: 'Loại chi phí', 
    enum: CostCategory,
    example: CostCategory.FERTILIZER 
  })
  @IsNotEmpty({ message: 'Loại chi phí không được để trống' })
  @IsEnum(CostCategory, { message: 'Loại chi phí không hợp lệ' })
  category!: CostCategory;

  @ApiProperty({ description: 'Tên khoản chi', example: 'Giống lúa OM 5451' })
  @IsNotEmpty({ message: 'Tên khoản chi không được để trống' })
  @IsString({ message: 'Tên khoản chi phải là chuỗi' })
  item_name!: string;

  @ApiPropertyOptional({ description: 'Số lượng', example: 50 })
  @IsOptional()
  @IsNumber({}, { message: 'Số lượng phải là số' })
  @Min(0, { message: 'Số lượng phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Đơn vị', example: 'kg' })
  @IsOptional()
  @IsString({ message: 'Đơn vị phải là chuỗi' })
  unit?: string;

  @ApiProperty({ description: 'Đơn giá', example: 50000 })
  @IsNotEmpty({ message: 'Đơn giá không được để trống' })
  @IsNumber({}, { message: 'Đơn giá phải là số' })
  @Min(0, { message: 'Đơn giá phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  unit_price!: number;

  @ApiProperty({ description: 'Tổng chi phí', example: 2500000 })
  @IsNotEmpty({ message: 'Tổng chi phí không được để trống' })
  @IsNumber({}, { message: 'Tổng chi phí phải là số' })
  @Min(0, { message: 'Tổng chi phí phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  total_cost!: number;

  @ApiPropertyOptional({ description: 'Ngày mua/chi', example: '2024-12-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày mua phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  purchase_date?: string;

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
  @ApiPropertyOptional({ 
    description: 'Loại chi phí', 
    enum: CostCategory,
    example: CostCategory.FERTILIZER 
  })
  @IsOptional()
  @IsEnum(CostCategory, { message: 'Loại chi phí không hợp lệ' })
  category?: CostCategory;

  @ApiPropertyOptional({ description: 'Tên khoản chi', example: 'Giống lúa OM 5451' })
  @IsOptional()
  @IsString({ message: 'Tên khoản chi phải là chuỗi' })
  item_name?: string;

  @ApiPropertyOptional({ description: 'Số lượng', example: 50 })
  @IsOptional()
  @IsNumber({}, { message: 'Số lượng phải là số' })
  @Min(0, { message: 'Số lượng phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Đơn vị', example: 'kg' })
  @IsOptional()
  @IsString({ message: 'Đơn vị phải là chuỗi' })
  unit?: string;

  @ApiPropertyOptional({ description: 'Đơn giá', example: 50000 })
  @IsOptional()
  @IsNumber({}, { message: 'Đơn giá phải là số' })
  @Min(0, { message: 'Đơn giá phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  unit_price?: number;

  @ApiPropertyOptional({ description: 'Tổng chi phí', example: 2500000 })
  @IsOptional()
  @IsNumber({}, { message: 'Tổng chi phí phải là số' })
  @Min(0, { message: 'Tổng chi phí phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  total_cost?: number;

  @ApiPropertyOptional({ description: 'Ngày mua/chi', example: '2024-12-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày mua phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  purchase_date?: string;

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
  @ApiPropertyOptional({ description: 'ID vụ lúa', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'ID vụ lúa phải là số' })
  @Type(() => Number)
  rice_crop_id?: number;

  @ApiPropertyOptional({ 
    description: 'Loại chi phí', 
    enum: CostCategory,
    example: CostCategory.FERTILIZER 
  })
  @IsOptional()
  @IsEnum(CostCategory, { message: 'Loại chi phí không hợp lệ' })
  category?: CostCategory;
}
