import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

/**
 * DTO (Data Transfer Object) dùng để tạo chi phí vận hành mới
 * Chứa các trường cần thiết để tạo một bản ghi chi phí vận hành
 */
export class CreateOperatingCostDto {
  /** Tên chi phí (bắt buộc) */
  @IsString()
  name!: string;

  /** Giá trị chi phí (bắt buộc) */
  @IsNumber()
  value!: number;

  /** ID Loại chi phí (bắt buộc) */
  @IsNumber()
  category_id!: number;

  /** Loại chi phí (deprecated - dùng category_id thay thế) */
  @IsOptional()
  @IsString()
  type?: string;

  /** Mô tả chi phí (tùy chọn) */
  @IsOptional()
  @IsString()
  description?: string;

  /** ID Mùa vụ liên quan (tùy chọn) */
  @IsOptional()
  @IsNumber()
  season_id?: number;

  /** ID Vụ lúa (Ruộng) liên quan (tùy chọn) */
  @IsOptional()
  @IsNumber()
  rice_crop_id?: number;

  /** Ngày phát sinh chi phí (tùy chọn, mặc định là ngày tạo) */
  @IsOptional()
  @IsDateString()
  expense_date?: string;
}
