import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * DTO xóa "Tích lũy hiện tại" của nhiều khách hàng.
 * Chỉ xóa pending_amount; tổng tích lũy và số lần nhận quà được giữ nguyên.
 */
export class ResetCustomerRewardDto {
  /** Danh sách ID khách hàng cần xóa tích lũy */
  @IsArray({ message: 'Danh sách khách hàng không hợp lệ' })
  @ArrayNotEmpty({ message: 'Cần chọn ít nhất một khách hàng để xóa tích lũy' })
  @ArrayMaxSize(200, { message: 'Chỉ được xóa tích lũy tối đa 200 khách hàng mỗi lần' })
  @IsInt({ each: true, message: 'Mã khách hàng không hợp lệ' })
  @Min(1, { each: true, message: 'Mã khách hàng không hợp lệ' })
  customer_ids!: number[];

  /** Lý do xóa tích lũy (bắt buộc để đối soát) */
  @IsString({ message: 'Lý do xóa tích lũy không hợp lệ' })
  @MaxLength(1000, { message: 'Lý do xóa tích lũy tối đa 1000 ký tự' })
  reason!: string;
}
