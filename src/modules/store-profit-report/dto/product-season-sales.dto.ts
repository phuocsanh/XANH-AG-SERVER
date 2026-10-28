import { ApiProperty } from '@nestjs/swagger';

export class ProductSeasonSalesDto {
  @ApiProperty({ example: 12 })
  product_id!: number;

  @ApiProperty({ example: 'Phân DAP' })
  product_name!: string;

  @ApiProperty({ example: 3 })
  season_id!: number;

  @ApiProperty({ example: 'Đông Xuân 2026' })
  season_name!: string;

  @ApiProperty({
    description: 'Số lượng trên các hóa đơn hợp lệ trước khi trừ trả hàng',
    example: 120,
  })
  quantity_invoiced!: number;

  @ApiProperty({ description: 'Số lượng đã trả lại', example: 10 })
  quantity_returned!: number;

  @ApiProperty({
    description: 'Số lượng thực bán sau khi trừ trả hàng, theo đơn vị cơ sở',
    example: 110,
  })
  quantity_sold!: number;

  @ApiProperty({
    description: 'Đơn vị cơ sở của sản phẩm',
    example: 'Kg',
    required: false,
  })
  unit_name?: string | undefined;

  @ApiProperty({ description: 'Số hóa đơn có sản phẩm này', example: 8 })
  invoice_count!: number;
}

/** Tổng hợp lợi nhuận gộp theo một loại sản phẩm trong mùa vụ. */
export class ProductTypeSeasonProfitBreakdownDto {
  @ApiProperty({ example: 3 })
  product_type_id!: number;

  @ApiProperty({ example: 'Phân bón gốc' })
  product_type_name!: string;

  @ApiProperty({ example: 120000000 })
  revenue!: number;

  @ApiProperty({ example: 90000000 })
  cost_of_goods_sold!: number;

  @ApiProperty({ example: 30000000 })
  gross_profit!: number;

  @ApiProperty({ description: 'Lợi nhuận gộp chia doanh thu thuần (%)', example: 25 })
  gross_margin!: number;

  @ApiProperty({ example: 18 })
  invoice_count!: number;
}

/** Tổng hợp lợi nhuận gộp của nhiều loại sản phẩm trong mùa vụ. */
export class ProductTypesSeasonProfitDto {
  @ApiProperty({ example: 3 })
  season_id!: number;

  @ApiProperty({ example: 'Đông Xuân 2026' })
  season_name!: string;

  @ApiProperty({ type: [Number], example: [3, 5] })
  product_type_ids!: number[];

  @ApiProperty({ example: 180000000 })
  revenue!: number;

  @ApiProperty({ example: 135000000 })
  cost_of_goods_sold!: number;

  @ApiProperty({ example: 45000000 })
  gross_profit!: number;

  @ApiProperty({ description: 'Lợi nhuận gộp chia doanh thu thuần (%)', example: 25 })
  gross_margin!: number;

  @ApiProperty({ example: 27 })
  invoice_count!: number;

  @ApiProperty({ type: [ProductTypeSeasonProfitBreakdownDto] })
  breakdown!: ProductTypeSeasonProfitBreakdownDto[];
}
