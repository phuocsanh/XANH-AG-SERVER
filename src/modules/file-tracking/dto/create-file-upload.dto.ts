import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsDate,
} from 'class-validator';

/**
 * DTO (Data Transfer Object) dùng để tạo file upload mới
 * Chứa các trường cần thiết để tạo một file upload
 */
export class CreateFileUploadDto {
  /** ID công khai của file (bắt buộc) */
  @IsString()
  publicId!: string;

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
  mimeType?: string;

  /** Số lượng tham chiếu đến file (tùy chọn) */
  @IsOptional()
  @IsNumber()
  referenceCount?: number;

  /** Trạng thái file tạm thời (tùy chọn) */
  @IsOptional()
  @IsBoolean()
  isTemporary?: boolean;

  /** Trạng thái file không được sử dụng (tùy chọn) */
  @IsOptional()
  @IsBoolean()
  isOrphaned?: boolean;

  /** ID của người dùng upload file (tùy chọn) */
  @IsOptional()
  @IsNumber()
  uploadedByUserId?: number;

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
  markedForDeletionAt?: Date;

  /** Thời gian xóa file (tùy chọn) */
  @IsOptional()
  @IsDate()
  deletedAt?: Date;
}
