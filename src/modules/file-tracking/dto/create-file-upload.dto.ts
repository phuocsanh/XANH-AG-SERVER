import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsDate,
} from 'class-validator';

export class CreateFileUploadDto {
  /** ID công khai của file (bắt buộc) */
  @IsString()
  public_id!: string;

  /** URL truy cập file (bắt buộc) */
  @IsString()
  url!: string;

  /** Tên file (bắt buộc) */
  @IsString()
  name!: string;

  /** Loại file (bắt buộc) */
  @IsString()
  type!: string;

  /** Kích thước file (bytes) (bắt buộc) */
  @IsNumber()
  size!: number;

  /** Thư mục chứa file (tùy chọn) */
  @IsOptional()
  @IsString()
  folder?: string;

  /** Loại MIME của file (tùy chọn) */
  @IsOptional()
  @IsString()
  mime_type?: string;

  /** Số lượng tham chiếu đến file (tùy chọn) */
  @IsOptional()
  @IsNumber()
  reference_count?: number;

  /** Trạng thái file tạm thời (tùy chọn) */
  @IsOptional()
  @IsBoolean()
  is_temporary?: boolean;

  /** Trạng thái file không được sử dụng (tùy chọn) */
  @IsOptional()
  @IsBoolean()
  is_orphaned?: boolean;

  /** ID của người dùng upload file (tùy chọn) */
  @IsOptional()
  @IsNumber()
  uploaded_by_user_id?: number;

  /** Mảng tag của file (tùy chọn) */
  @IsOptional()
  @IsArray()
  tags?: string[];

  /** Metadata của file (tùy chọn) */
  @IsOptional()
  metadata?: any;

  /** Thời gian đánh dấu để xóa file (tùy chọn) */
  @IsOptional()
  @IsDate()
  marked_for_deletion_at?: Date;

  /** Thời gian xóa file (tùy chọn) */
  @IsOptional()
  @IsDate()
  deleted_at?: Date;
}
