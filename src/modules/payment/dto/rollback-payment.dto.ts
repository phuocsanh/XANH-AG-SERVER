import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Dữ liệu hoàn tác phiếu thu.
 * Lý do là bắt buộc để phục vụ đối soát và lưu vết.
 */
export class RollbackPaymentDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Lý do hoàn tác không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do hoàn tác phiếu thu' })
  @MaxLength(500, { message: 'Lý do hoàn tác tối đa 500 ký tự' })
  reason!: string;

  /** Client mới gửi dấu đối chiếu preview; client cũ vẫn được đối soát lại trong transaction. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Bản xem trước không hợp lệ, vui lòng tải lại' })
  preview_token?: string;
}
