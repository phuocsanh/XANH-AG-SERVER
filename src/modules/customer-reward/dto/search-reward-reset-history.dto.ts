import { IsNumber, IsOptional, IsString } from 'class-validator';

/** DTO tìm kiếm lịch sử xóa tích lũy hiện tại của khách hàng */
export class SearchRewardResetHistoryDto {
  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;

  /** Tìm theo tên khách hàng (không phân biệt dấu) */
  @IsOptional()
  @IsString()
  customer_name?: string;

  /** Tìm theo số điện thoại khách hàng */
  @IsOptional()
  @IsString()
  customer_phone?: string;

  /** Lọc theo trạng thái: active (chưa khôi phục) hoặc restored (đã khôi phục) */
  @IsOptional()
  @IsString()
  status?: string;

  /** Lọc từ ngày (định dạng YYYY-MM-DD) */
  @IsOptional()
  @IsString()
  from_date?: string;

  /** Lọc đến ngày (định dạng YYYY-MM-DD) */
  @IsOptional()
  @IsString()
  to_date?: string;
}
