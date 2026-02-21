import {
  IsNumber,
  IsBoolean,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * DTO tạo mới bảng quy đổi đơn vị tính cho sản phẩm.
 * Ví dụ: Phân NPK - 1 BAO = 50 KG
 */
export class CreateProductUnitConversionDto {
  /** ID sản phẩm (bắt buộc) */
  @IsNumber()
  product_id!: number;

  /** ID đơn vị tính (bắt buộc) */
  @IsNumber()
  unit_id!: number;

  /** Tên đơn vị tính (snapshot, tùy chọn) */
  @IsString()
  @IsOptional()
  unit_name?: string;

  /**
   * Hệ số quy đổi về đơn vị cơ sở (bắt buộc).
   * Đơn vị cơ sở: factor = 1. Ví dụ: BAO = 50 (nếu 1 bao = 50 kg).
   */
  @IsNumber()
  @Min(0.000001, { message: 'Hệ số quy đổi phải lớn hơn 0' })
  conversion_factor!: number;

  /** Đây là đơn vị cơ sở không? (KG, ML...) */
  @IsBoolean()
  @IsOptional()
  is_base_unit?: boolean;

  /** Đơn vị này dùng khi nhập kho không? */
  @IsBoolean()
  @IsOptional()
  is_purchase_unit?: boolean;

  /** Đơn vị này dùng khi bán hàng không? */
  @IsBoolean()
  @IsOptional()
  is_sales_unit?: boolean;

  /** Thứ tự hiển thị */
  @IsNumber()
  @IsOptional()
  sort_order?: number;

  /** Ghi chú (ví dụ: "1 bao = 50kg") */
  @IsString()
  @IsOptional()
  notes?: string;
}

/** DTO cập nhật (tất cả field đều optional) */
export class UpdateProductUnitConversionDto {
  @IsNumber()
  @IsOptional()
  unit_id?: number;

  @IsString()
  @IsOptional()
  unit_name?: string;

  @IsNumber()
  @IsOptional()
  @Min(0.000001)
  conversion_factor?: number;

  @IsBoolean()
  @IsOptional()
  is_base_unit?: boolean;

  @IsBoolean()
  @IsOptional()
  is_purchase_unit?: boolean;

  @IsBoolean()
  @IsOptional()
  is_sales_unit?: boolean;

  @IsNumber()
  @IsOptional()
  sort_order?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

/** DTO lưu toàn bộ danh sách quy đổi cho 1 sản phẩm (upsert) */
export class SaveProductUnitConversionsDto {
  /** Danh sách quy đổi đơn vị tính cho sản phẩm */
  items!: CreateProductUnitConversionDto[];
}
