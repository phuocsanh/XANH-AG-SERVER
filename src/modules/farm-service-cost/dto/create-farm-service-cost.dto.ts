import { IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO để tạo chi phí dịch vụ cho nông dân mới
 */
export class CreateFarmServiceCostDto {
  @ApiProperty({ description: 'Tên chi phí/quà tặng', example: 'Kỹ sư thăm ruộng' })
  @IsNotEmpty({ message: 'Tên chi phí không được để trống' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Số tiền', example: 500000 })
  @IsNotEmpty({ message: 'Số tiền không được để trống' })
  @IsNumber()
  amount!: number;

  @ApiProperty({ description: 'ID Mùa vụ', example: 1 })
  @IsNotEmpty({ message: 'Mùa vụ không được để trống' })
  @IsNumber()
  season_id!: number;

  @ApiProperty({ description: 'ID Khách hàng', example: 1 })
  @IsNotEmpty({ message: 'Khách hàng không được để trống' })
  @IsNumber()
  customer_id!: number;

  @ApiPropertyOptional({ description: 'ID Ruộng lúa', example: 1 })
  @IsOptional()
  @IsNumber()
  rice_crop_id?: number;

  @ApiPropertyOptional({ description: 'Ghi chú', example: 'Hỗ trợ kỹ thuật tháng 12' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Ngày phát sinh', example: '2025-12-23T00:00:00.000Z' })
  @IsNotEmpty({ message: 'Ngày phát sinh không được để trống' })
  @IsDateString()
  expense_date!: string;

  @ApiPropertyOptional({ description: 'Nguồn gốc', example: 'manual' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'ID hóa đơn liên quan', example: 1 })
  @IsOptional()
  @IsNumber()
  invoice_id?: number;
}
