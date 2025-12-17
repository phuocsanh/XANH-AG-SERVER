import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO để tạo vùng/lô đất mới
 */
export class CreateAreaOfEachPlotOfLandDto {
  @ApiProperty({ description: 'Tên vùng/lô đất', example: 'Lô A1' })
  @IsNotEmpty({ message: 'Tên vùng/lô đất không được để trống' })
  @IsString({ message: 'Tên phải là chuỗi' })
  @MaxLength(255, { message: 'Tên không được vượt quá 255 ký tự' })
  name!: string;

  @ApiProperty({ description: 'Mã vùng/lô đất', example: 'LA1' })
  @IsOptional()
  @IsString({ message: 'Mã phải là chuỗi' })
  @MaxLength(50, { message: 'Mã không được vượt quá 50 ký tự' })
  code?: string;

  @ApiProperty({ description: 'Diện tích (m2)', example: 1000 })
  @IsNotEmpty({ message: 'Diện tích không được để trống' })
  @IsNumber({}, { message: 'Diện tích phải là số' })
  @Min(0, { message: 'Diện tích phải lớn hơn 0' })
  @Type(() => Number)
  acreage!: number;
}

/**
 * DTO để cập nhật vùng/lô đất
 */
export class UpdateAreaOfEachPlotOfLandDto {
  @ApiPropertyOptional({ description: 'Tên vùng/lô đất', example: 'Lô A1' })
  @IsOptional()
  @IsString({ message: 'Tên phải là chuỗi' })
  @MaxLength(255, { message: 'Tên không được vượt quá 255 ký tự' })
  name?: string;

  @ApiPropertyOptional({ description: 'Mã vùng/lô đất', example: 'LA1' })
  @IsOptional()
  @IsString({ message: 'Mã phải là chuỗi' })
  @MaxLength(50, { message: 'Mã không được vượt quá 50 ký tự' })
  code?: string;

  @ApiPropertyOptional({ description: 'Diện tích (m2)', example: 1000 })
  @IsOptional()
  @IsNumber({}, { message: 'Diện tích phải là số' })
  @Min(0, { message: 'Diện tích phải lớn hơn 0' })
  @Type(() => Number)
  acreage?: number;
}

/**
 * DTO để tìm kiếm vùng/lô đất
 */
export class SearchAreaOfEachPlotOfLandDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc mã', example: 'Lô A' })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi' })
  keyword?: string;

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
