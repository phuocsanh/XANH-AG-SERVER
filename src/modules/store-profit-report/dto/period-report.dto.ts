import { ApiProperty } from '@nestjs/swagger';

export class PeriodSummaryDto {
  @ApiProperty({ description: 'Tổng doanh thu' })
  total_revenue!: number;

  @ApiProperty({ description: 'Doanh thu từ sản phẩm có hóa đơn' })
  revenue_with_invoice!: number;

  @ApiProperty({ description: 'Doanh thu từ sản phẩm không hóa đơn' })
  revenue_no_invoice!: number;

  @ApiProperty({ description: 'Doanh thu khai báo thuế (chỉ tính sản phẩm có hóa đơn đầu vào)' })
  taxable_revenue!: number;

  @ApiProperty({ description: 'Tổng giá vốn hàng bán' })
  total_cogs!: number;

  @ApiProperty({ description: 'Giá vốn sản phẩm có hóa đơn' })
  cogs_with_invoice!: number;

  @ApiProperty({ description: 'Giá vốn sản phẩm không hóa đơn' })
  cogs_no_invoice!: number;

  @ApiProperty({ description: 'Lợi nhuận gộp' })
  gross_profit!: number;

  @ApiProperty({ description: 'Tổng chi phí vận hành' })
  total_operating_costs!: number;

  @ApiProperty({ description: 'Tổng chi phí quà tặng/dịch vụ' })
  total_gift_costs!: number;

  @ApiProperty({ description: 'Lợi nhuận ròng' })
  net_profit!: number;

  @ApiProperty({ description: 'Số lượng hóa đơn' })
  invoice_count!: number;
}

export class PeriodReportDto {
  @ApiProperty({ description: 'Thông tin tổng hợp' })
  summary!: PeriodSummaryDto;

  @ApiProperty({ description: 'Ngày bắt đầu' })
  start_date!: Date;

  @ApiProperty({ description: 'Ngày kết thúc' })
  end_date!: Date;
}
