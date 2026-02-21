import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { BaseStatus } from '../../../entities/base-status.enum';
import { CreateProductUnitConversionDto } from '../../product-unit-conversion/dto/create-product-unit-conversion.dto';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

/**
 * DTO (Data Transfer Object) dùng để tạo sản phẩm mới
 * Chứa các trường cần thiết để tạo một sản phẩm
 */
export class CreateProductDto {
  /** Mã sản phẩm (tùy chọn, BE sẽ tự động tạo nếu không có) */
  @IsOptional()
  @IsString()
  code?: string;

  /** Tên sản phẩm (bắt buộc) */
  @IsString()
  name!: string;

  /** Hiệu thuốc / Tên thương mại (bắt buộc) */
  @IsString()
  trade_name!: string;

  /** Dung tích / Khối lượng (tùy chọn) */
  @IsOptional()
  @IsString()
  volume?: string;

  /** Giá sản phẩm (Giá tiền mặt) (tùy chọn) */
  @IsOptional()
  @IsString()
  price?: string;

  /** Giá bán nợ (tùy chọn) */
  @IsOptional()
  @IsString()
  credit_price?: string;

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
  sub_product_type?: number[];

  /** Phần trăm giảm giá (tùy chọn) */
  @IsOptional()
  @IsString()
  discount?: string;

  /** Giá sau khi giảm giá (bắt buộc) */
  @IsString()
  discounted_price!: string;

  /** Số lượng đã bán (tùy chọn) */
  @IsOptional()
  @IsNumber()
  selled?: number;

  /** Thuộc tính sản phẩm (tùy chọn) */
  @IsOptional()
  attributes?: any;

  /** Giá vốn trung bình của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsString()
  average_cost_price?: string;

  /** Phần trăm lợi nhuận (tùy chọn) */
  @IsOptional()
  @IsString()
  profit_margin_percent?: string;

  /** Đơn vị tính của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsNumber()
  unit_id?: number;

  /** Giá nhập mới nhất của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsString()
  latest_purchase_price?: string;

  /** Mã ký hiệu của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsNumber()
  symbol_id?: number;

  /** Thành phần nguyên liệu của sản phẩm (tùy chọn) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ingredient?: string[];

  /** Ghi chú về sản phẩm (tùy chọn) */
  @IsOptional()
  @IsString()
  notes?: string;

  /** Trạng thái hóa đơn đầu vào (tùy chọn) */
  @IsOptional()
  @IsBoolean()
  has_input_invoice?: boolean;

  /** Giá bán khai thuế */
  @IsString()
  tax_selling_price!: string;

  /** Số lượng tồn kho có hóa đơn đầu vào (bể thuế) */
  @IsOptional()
  @IsNumber()
  taxable_quantity_stock?: number;

  /** Cho phép bán trên Web Next.js */
  @IsOptional()
  @IsBoolean()
  is_sold_on_web?: boolean;

  /** Hiển thị giá trên Web Next.js */
  @IsOptional()
  @IsBoolean()
  show_price_on_web?: boolean;
  /** Danh sách quy đổi đơn vị tính (tùy chọn) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductUnitConversionDto)
  unit_conversions?: CreateProductUnitConversionDto[];
}
