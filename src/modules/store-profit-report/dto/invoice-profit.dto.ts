import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO cho chi tiết lợi nhuận từng sản phẩm trong hóa đơn
 */
export class InvoiceItemProfitDto {
  @ApiProperty({ description: 'Tên sản phẩm', example: 'Phân DAP' })
  product_name!: string;

  @ApiProperty({ description: 'Số lượng', example: 10 })
  quantity!: number;

  @ApiProperty({ description: 'Giá bán/đơn vị', example: 150000 })
  unit_price!: number;

  @ApiProperty({ description: 'Giá vốn trung bình', example: 120000 })
  avg_cost!: number;

  @ApiProperty({ description: 'Tổng giá vốn', example: 1200000 })
  cogs!: number;

  @ApiProperty({ description: 'Lợi nhuận', example: 300000 })
  profit!: number;

  @ApiProperty({ description: 'Tỷ suất lợi nhuận (%)', example: 20 })
  margin!: number;
}

/**
 * DTO cho lợi nhuận mỗi đơn hàng
 */
export class InvoiceProfitDto {
  @ApiProperty({ description: 'ID hóa đơn', example: 123 })
  invoice_id!: number;

  @ApiProperty({ description: 'Mã hóa đơn', example: 'INV-2024-123' })
  invoice_code!: string;

  @ApiProperty({ description: 'Tên khách hàng', example: 'Nguyễn Văn A' })
  customer_name!: string;

  @ApiProperty({ description: 'Ngày tạo' })
  created_at!: Date;

  @ApiProperty({ description: 'Tổng doanh thu', example: 2300000 })
  total_amount!: number;

  @ApiProperty({ description: 'Tổng giá vốn hàng bán', example: 1900000 })
  cost_of_goods_sold!: number;

  @ApiProperty({ description: 'Lợi nhuận gộp', example: 400000 })
  gross_profit!: number;

  @ApiProperty({ description: 'Tỷ suất lợi nhuận gộp (%)', example: 17.4 })
  gross_margin!: number;

  @ApiProperty({ description: 'Mô tả quà tặng', example: '1 thùng nước ngọt Coca', required: false })
  gift_description?: string | undefined;

  @ApiProperty({ description: 'Giá trị quà tặng', example: 50000 })
  gift_value!: number;

  @ApiProperty({ description: 'Lợi nhuận ròng (sau trừ quà tặng)', example: 350000 })
  net_profit!: number;

  @ApiProperty({ description: 'Chi tiết lợi nhuận từng sản phẩm', type: [InvoiceItemProfitDto] })
  item_details!: InvoiceItemProfitDto[];
}
