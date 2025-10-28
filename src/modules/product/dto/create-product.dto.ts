import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
} from 'class-validator';
import { BaseStatus } from '../../../entities/base-status.enum';

/**
 * DTO (Data Transfer Object) dùng để tạo sản phẩm mới
 * Chứa các trường cần thiết để tạo một sản phẩm
 */
export class CreateProductDto {
  /** Tên sản phẩm (bắt buộc) */
  @IsString()
  name!: string;

  /** Giá sản phẩm (bắt buộc) */
  @IsString()
  price!: string;

  /** Trạng thái sản phẩm mới sử dụng enum (tùy chọn) */
  @IsOptional()
  @IsEnum(BaseStatus, {
    message:
      'Trạng thái phải là một trong các giá trị: active, inactive, archived',
  })
  status?: BaseStatus;

  /** Đường dẫn thumbnail của sản phẩm (bắt buộc) */
  @IsString()
  thumb!: string;

  /** Mảng đường dẫn hình ảnh của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsArray()
  pictures?: string[];

  /** Mảng đường dẫn video của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsArray()
  videos?: string[];

  /** Mô tả sản phẩm (tùy chọn) */
  @IsOptional()
  @IsString()
  description?: string;

  /** Số lượng tồn kho của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsNumber()
  quantity?: number;

  /** Loại sản phẩm (bắt buộc) */
  @IsNumber()
  type!: number;

  /** Mảng loại phụ sản phẩm (tùy chọn) */
  @IsOptional()
  @IsArray()
  subProductType?: number[];

  /** Phần trăm giảm giá (tùy chọn) */
  @IsOptional()
  @IsString()
  discount?: string;

  /** Giá sau khi giảm giá (bắt buộc) */
  @IsString()
  discountedPrice!: string;

  /** Số lượng đã bán (tùy chọn) */
  @IsOptional()
  @IsNumber()
  selled?: number;

  /** Thuộc tính sản phẩm (tùy chọn) */
  @IsOptional()
  attributes?: any;

  /** Giá vốn trung bình của sản phẩm (bắt buộc) */
  @IsString()
  averageCostPrice!: string;

  /** Phần trăm lợi nhuận (bắt buộc) */
  @IsString()
  profitMarginPercent!: string;

  /** Đơn vị tính của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsNumber()
  unitId?: number;

  /** Giá nhập mới nhất của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsNumber()
  latestPurchasePrice?: number;

  /** Mã ký hiệu của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsNumber()
  symbolId?: number;

  /** Thành phần nguyên liệu của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ingredient?: string[];
}
