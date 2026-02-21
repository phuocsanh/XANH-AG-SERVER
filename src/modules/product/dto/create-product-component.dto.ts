import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

/**
 * DTO dùng để khai báo thành phần cấu tạo (BOM) cho sản phẩm
 */
export class CreateProductComponentDto {
  /** ID sản phẩm thành phần (nguyên liệu) */
  @IsNotEmpty()
  @IsNumber()
  componentProductId!: number;

  /** Số lượng cần dùng */
  @IsNotEmpty()
  @IsNumber()
  quantity!: number;

  /** ID đơn vị tính cho số lượng thành phần (tùy chọn) */
  @IsOptional()
  @IsNumber()
  unitId?: number;
}
