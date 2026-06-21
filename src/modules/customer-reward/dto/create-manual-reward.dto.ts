import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateManualRewardDto {
  @IsNumber()
  customer_id!: number;

  @IsString()
  gift_description!: string;

  @IsNumber()
  @IsOptional()
  gift_value?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  @IsNumber()
  manual_deduct_amount?: number;

  @IsOptional()
  @IsNumber()
  season_id?: number;

  @IsOptional()
  @IsNumber()
  rice_crop_id?: number;

  /** ID sản phẩm quà lấy từ kho cửa hàng */
  @IsOptional()
  @IsNumber()
  gift_product_id?: number;

  /** Số lượng sản phẩm quà */
  @IsOptional()
  @IsNumber()
  gift_quantity?: number;

  /** Đơn giá hạch toán sản phẩm quà */
  @IsOptional()
  @IsNumber()
  gift_unit_price?: number;

  /** Loại phần quà (ACCUMULATION_REWARD hoặc APPRECIATION_GIFT) */
  @IsString()
  @IsOptional()
  reward_type?: string;

  /** Trạng thái quà tặng (pending, delivered, cancelled) */
  @IsString()
  @IsOptional()
  gift_status?: string;
}
