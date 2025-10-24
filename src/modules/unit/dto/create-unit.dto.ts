import { IsString, IsOptional, IsEnum } from 'class-validator';
import { BaseStatus } from '../../../entities/base-status.enum';

/**
 * DTO (Data Transfer Object) dùng để tạo đơn vị tính mới
 * Chứa các trường cần thiết để tạo một đơn vị tính
 */
export class CreateUnitDto {
  /** Tên đơn vị tính (bắt buộc) */
  @IsString()
  unitName!: string;

  /** Mã đơn vị tính (bắt buộc) */
  @IsString()
  unitCode!: string;

  /** Mô tả đơn vị tính (tùy chọn) */
  @IsOptional()
  @IsString()
  description?: string;

  /** Trạng thái đơn vị tính (tùy chọn) */
  @IsOptional()
  @IsEnum(BaseStatus, {
    message:
      'Trạng thái phải là một trong các giá trị: active, inactive, archived',
  })
  status?: BaseStatus;
}
