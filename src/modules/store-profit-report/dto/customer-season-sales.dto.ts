import { ApiProperty } from '@nestjs/swagger';

/** Tổng tiền bán cho một khách hàng trong mùa vụ, chia theo danh mục sản phẩm. */
export class CustomerSeasonSalesDto {
  @ApiProperty({ example: 21 })
  customer_id!: number;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  customer_name!: string;

  @ApiProperty({ example: 4 })
  season_id!: number;

  @ApiProperty({ example: 'Đông Xuân 2026' })
  season_name!: string;

  @ApiProperty({ description: 'Tiền bán sản phẩm thuộc danh mục Phân bón gốc' })
  base_fertilizer_amount!: number;

  @ApiProperty({ description: 'Tiền bán các sản phẩm thuộc danh mục khác, trừ Lúa giống' })
  other_products_amount!: number;

  @ApiProperty({ description: 'Tổng tiền bán của hai nhóm sản phẩm' })
  total_amount!: number;
}
