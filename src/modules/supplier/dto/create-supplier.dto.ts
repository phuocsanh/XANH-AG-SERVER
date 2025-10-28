import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { BaseStatus } from '../../../entities/base-status.enum';

/**
 * DTO (Data Transfer Object) dùng để tạo nhà cung cấp mới
 * Chứa các trường cần thiết để tạo một nhà cung cấp
 */
export class CreateSupplierDto {
  /** Tên nhà cung cấp (bắt buộc) */
  @IsString()
  name!: string;

  /** Mã nhà cung cấp (bắt buộc) */
  @IsString()
  code!: string;

  /** Địa chỉ nhà cung cấp (tùy chọn) */
  @IsString()
  @IsOptional()
  address?: string;

  /** Số điện thoại liên hệ (tùy chọn) */
  @IsString()
  @IsOptional()
  phone?: string;

  /** Email liên hệ (tùy chọn) */
  @IsString()
  @IsOptional()
  email?: string;

  /** Người liên hệ (tùy chọn) */
  @IsString()
  @IsOptional()
  contactPerson?: string;

  /** Trạng thái nhà cung cấp (tùy chọn) */
  @IsOptional()
  @IsEnum(BaseStatus)
  status?: BaseStatus;

  /** Ghi chú về nhà cung cấp (tùy chọn) */
  @IsString()
  @IsOptional()
  notes?: string;

  /** ID của người tạo (bắt buộc) */
  @IsNumber()
  createdBy!: number;
}
