import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsNotEmpty, 
  IsNumber, 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsDateString,
  Min,
  MaxLength 
} from 'class-validator';
import { Type } from 'class-transformer';
import { GrowthStage, CropStatus } from '../../entities/rice-crop.entity';

/**
 * DTO để tạo mảnh ruộng mới
 */
export class CreateRiceCropDto {
  @ApiProperty({ description: 'ID khách hàng (nông dân)', example: 1 })
  @IsNotEmpty({ message: 'ID khách hàng không được để trống' })
  @IsNumber({}, { message: 'ID khách hàng phải là số' })
  @Type(() => Number)
  customer_id!: number;

  @ApiProperty({ description: 'ID mùa vụ', example: 1 })
  @IsNotEmpty({ message: 'ID mùa vụ không được để trống' })
  @IsNumber({}, { message: 'ID mùa vụ phải là số' })
  @Type(() => Number)
  season_id!: number;

  @ApiProperty({ description: 'Tên ruộng/lô', example: 'Ruộng sau nhà' })
  @IsNotEmpty({ message: 'Tên ruộng không được để trống' })
  @IsString({ message: 'Tên ruộng phải là chuỗi' })
  @MaxLength(100, { message: 'Tên ruộng không được vượt quá 100 ký tự' })
  field_name!: string;

  @ApiProperty({ description: 'Diện tích ruộng (m²)', example: 5000 })
  @IsNotEmpty({ message: 'Diện tích không được để trống' })
  @IsNumber({}, { message: 'Diện tích phải là số' })
  @Min(0, { message: 'Diện tích phải lớn hơn 0' })
  @Type(() => Number)
  field_area!: number;

  @ApiProperty({ description: 'Số lượng đất', example: 10 })
  @IsNotEmpty({ message: 'Số lượng đất không được để trống' })
  @IsNumber({}, { message: 'Số lượng đất phải là số' })
  @Min(0, { message: 'Số lượng đất phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  amount_of_land!: number;

  @ApiPropertyOptional({ description: 'ID vùng/lô đất', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'ID vùng/lô đất phải là số' })
  @Type(() => Number)
  area_of_each_plot_of_land_id?: number;

  @ApiPropertyOptional({ description: 'Vị trí địa lý', example: 'Xã Tân Hiệp, An Giang' })
  @IsOptional()
  @IsString({ message: 'Vị trí phải là chuỗi' })
  location?: string;

  @ApiProperty({ description: 'Giống lúa', example: 'OM 5451' })
  @IsNotEmpty({ message: 'Giống lúa không được để trống' })
  @IsString({ message: 'Giống lúa phải là chuỗi' })
  @MaxLength(100, { message: 'Giống lúa không được vượt quá 100 ký tự' })
  rice_variety!: string;

  @ApiPropertyOptional({ description: 'Nguồn giống', example: 'Trung tâm giống An Giang' })
  @IsOptional()
  @IsString({ message: 'Nguồn giống phải là chuỗi' })
  @MaxLength(255, { message: 'Nguồn giống không được vượt quá 255 ký tự' })
  seed_source?: string;

  @ApiPropertyOptional({ description: 'Ngày gieo mạ', example: '2024-11-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày gieo mạ phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  sowing_date?: string;

  @ApiPropertyOptional({ description: 'Ngày cấy', example: '2024-11-20' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày cấy phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  transplanting_date?: string;

  @ApiPropertyOptional({ description: 'Ngày dự kiến thu hoạch', example: '2025-02-15' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày dự kiến thu hoạch phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  expected_harvest_date?: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}

/**
 * DTO để cập nhật thông tin mảnh ruộng
 */
export class UpdateRiceCropDto {
  @ApiPropertyOptional({ description: 'Tên ruộng/lô', example: 'Ruộng sau nhà' })
  @IsOptional()
  @IsString({ message: 'Tên ruộng phải là chuỗi' })
  @MaxLength(100, { message: 'Tên ruộng không được vượt quá 100 ký tự' })
  field_name?: string;

  @ApiPropertyOptional({ description: 'Diện tích ruộng (m²)', example: 5000 })
  @IsOptional()
  @IsNumber({}, { message: 'Diện tích phải là số' })
  @Min(0, { message: 'Diện tích phải lớn hơn 0' })
  @Type(() => Number)
  field_area?: number;

  @ApiPropertyOptional({ description: 'Số lượng đất', example: 10 })
  @IsOptional()
  @IsNumber({}, { message: 'Số lượng đất phải là số' })
  @Min(0, { message: 'Số lượng đất phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  amount_of_land?: number;

  @ApiPropertyOptional({ description: 'ID vùng/lô đất', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'ID vùng/lô đất phải là số' })
  @Type(() => Number)
  area_of_each_plot_of_land_id?: number;

  @ApiPropertyOptional({ description: 'Vị trí địa lý', example: 'Xã Tân Hiệp, An Giang' })
  @IsOptional()
  @IsString({ message: 'Vị trí phải là chuỗi' })
  location?: string;

  @ApiPropertyOptional({ description: 'Giống lúa', example: 'OM 5451' })
  @IsOptional()
  @IsString({ message: 'Giống lúa phải là chuỗi' })
  @MaxLength(100, { message: 'Giống lúa không được vượt quá 100 ký tự' })
  rice_variety?: string;

  @ApiPropertyOptional({ description: 'Nguồn giống', example: 'Trung tâm giống An Giang' })
  @IsOptional()
  @IsString({ message: 'Nguồn giống phải là chuỗi' })
  @MaxLength(255, { message: 'Nguồn giống không được vượt quá 255 ký tự' })
  seed_source?: string;

  @ApiPropertyOptional({ description: 'Ngày gieo mạ', example: '2024-11-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày gieo mạ phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  sowing_date?: string;

  @ApiPropertyOptional({ description: 'Ngày cấy', example: '2024-11-20' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày cấy phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  transplanting_date?: string;

  @ApiPropertyOptional({ description: 'Ngày dự kiến thu hoạch', example: '2025-02-15' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày dự kiến thu hoạch phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  expected_harvest_date?: string;

  @ApiPropertyOptional({ description: 'Ngày thu hoạch thực tế', example: '2025-02-18' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày thu hoạch thực tế phải là định dạng ngày hợp lệ (YYYY-MM-DD)' })
  actual_harvest_date?: string;

  @ApiPropertyOptional({ description: 'Năng suất thu hoạch (kg)', example: 3000 })
  @IsOptional()
  @IsNumber({}, { message: 'Năng suất phải là số' })
  @Min(0, { message: 'Năng suất phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  yield_amount?: number;

  @ApiPropertyOptional({ description: 'Chất lượng gạo', example: 'A' })
  @IsOptional()
  @IsString({ message: 'Chất lượng phải là chuỗi' })
  @MaxLength(10, { message: 'Chất lượng không được vượt quá 10 ký tự' })
  quality_grade?: string;

  @ApiPropertyOptional({ 
    description: 'Giai đoạn sinh trưởng', 
    enum: GrowthStage,
    example: GrowthStage.TILLERING 
  })
  @IsOptional()
  @IsEnum(GrowthStage, { message: 'Giai đoạn sinh trưởng không hợp lệ' })
  growth_stage?: GrowthStage;

  @ApiPropertyOptional({ 
    description: 'Trạng thái vụ lúa', 
    enum: CropStatus,
    example: CropStatus.ACTIVE 
  })
  @IsOptional()
  @IsEnum(CropStatus, { message: 'Trạng thái không hợp lệ' })
  status?: CropStatus;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}

/**
 * DTO để cập nhật giai đoạn sinh trưởng
 */
export class UpdateGrowthStageDto {
  @ApiProperty({ 
    description: 'Giai đoạn sinh trưởng', 
    enum: GrowthStage,
    example: GrowthStage.TILLERING 
  })
  @IsNotEmpty({ message: 'Giai đoạn sinh trưởng không được để trống' })
  @IsEnum(GrowthStage, { message: 'Giai đoạn sinh trưởng không hợp lệ' })
  growth_stage!: GrowthStage;

  @ApiPropertyOptional({ description: 'Ghi chú về giai đoạn sinh trưởng' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}

/**
 * DTO để cập nhật trạng thái mảnh ruộng
 */
export class UpdateCropStatusDto {
  @ApiProperty({ 
    description: 'Trạng thái vụ lúa', 
    enum: CropStatus,
    example: CropStatus.HARVESTED 
  })
  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  @IsEnum(CropStatus, { message: 'Trạng thái không hợp lệ' })
  status!: CropStatus;

  @ApiPropertyOptional({ description: 'Ghi chú về trạng thái' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}

/**
 * DTO để query/filter danh sách mảnh ruộng
 */
export class QueryRiceCropDto {
  @ApiPropertyOptional({ description: 'ID khách hàng', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'ID khách hàng phải là số' })
  @Type(() => Number)
  customer_id?: number;

  @ApiPropertyOptional({ description: 'ID mùa vụ', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'ID mùa vụ phải là số' })
  @Type(() => Number)
  season_id?: number;

  @ApiPropertyOptional({ 
    description: 'Trạng thái vụ lúa', 
    enum: CropStatus,
    example: CropStatus.ACTIVE 
  })
  @IsOptional()
  @IsEnum(CropStatus, { message: 'Trạng thái không hợp lệ' })
  status?: CropStatus;

  @ApiPropertyOptional({ 
    description: 'Giai đoạn sinh trưởng', 
    enum: GrowthStage,
    example: GrowthStage.TILLERING 
  })
  @IsOptional()
  @IsEnum(GrowthStage, { message: 'Giai đoạn sinh trưởng không hợp lệ' })
  growth_stage?: GrowthStage;
}

/**
 * DTO để tìm kiếm vụ lúa (nâng cao)
 */
export class SearchRiceCropDto extends QueryRiceCropDto {
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
