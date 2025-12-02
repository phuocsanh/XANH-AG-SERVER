import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../../entities/harvest-record.entity';

export class CreateHarvestRecordDto {
  @ApiProperty({ description: 'ID vụ lúa', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  rice_crop_id!: number;

  @ApiProperty({ description: 'Ngày thu hoạch', example: '2025-02-18' })
  @IsNotEmpty()
  @IsDateString()
  harvest_date!: string;

  @ApiProperty({ description: 'Năng suất (kg)', example: 3000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  yield_amount!: number;

  @ApiPropertyOptional({ description: 'Độ ẩm (%)', example: 14.5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  moisture_content?: number;

  @ApiProperty({ description: 'Chất lượng', example: 'A' })
  @IsNotEmpty()
  @IsString()
  quality_grade!: string;

  @ApiProperty({ description: 'Giá bán/kg', example: 8000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  selling_price_per_unit!: number;

  @ApiProperty({ description: 'Tổng doanh thu', example: 24000000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total_revenue!: number;

  @ApiPropertyOptional({ description: 'Người mua' })
  @IsOptional()
  @IsString()
  buyer?: string;

  @ApiPropertyOptional({ description: 'Trạng thái thanh toán', enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Ngày thanh toán' })
  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHarvestRecordDto {
  @ApiPropertyOptional({ description: 'Ngày thu hoạch' })
  @IsOptional()
  @IsDateString()
  harvest_date?: string;

  @ApiPropertyOptional({ description: 'Năng suất (kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  yield_amount?: number;

  @ApiPropertyOptional({ description: 'Độ ẩm (%)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  moisture_content?: number;

  @ApiPropertyOptional({ description: 'Chất lượng' })
  @IsOptional()
  @IsString()
  quality_grade?: string;

  @ApiPropertyOptional({ description: 'Giá bán/kg' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  selling_price_per_unit?: number;

  @ApiPropertyOptional({ description: 'Tổng doanh thu' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total_revenue?: number;

  @ApiPropertyOptional({ description: 'Người mua' })
  @IsOptional()
  @IsString()
  buyer?: string;

  @ApiPropertyOptional({ description: 'Trạng thái thanh toán', enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Ngày thanh toán' })
  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  notes?: string;
}
