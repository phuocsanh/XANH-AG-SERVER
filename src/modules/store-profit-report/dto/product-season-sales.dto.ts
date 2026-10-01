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
