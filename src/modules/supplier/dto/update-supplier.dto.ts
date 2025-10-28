import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { BaseStatus } from '../../../entities/base-status.enum';

/**
 * DTO (Data Transfer Object) dùng để cập nhật thông tin nhà cung cấp
 * Chứa các trường có thể cập nhật của nhà cung cấp
 */
export class UpdateSupplierDto {
  /** Tên nhà cung cấp (tùy chọn) */
  @IsString()
  @IsOptional()
  name?: string;

  /** Mã nhà cung cấp (tùy chọn) */
  @IsString()
  @IsOptional()
  code?: string;

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

  /** ID của người cập nhật (tùy chọn) */
  @IsNumber()
  @IsOptional()
  updatedBy?: number;
}
