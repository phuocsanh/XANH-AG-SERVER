import { IsString, IsNumber, IsOptional } from 'class-validator';

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

  /** Loại chi phí (bắt buộc) */
  @IsString()
  type!: string;

  /** Mô tả chi phí (tùy chọn) */
  @IsOptional()
  @IsString()
  description?: string;
}
