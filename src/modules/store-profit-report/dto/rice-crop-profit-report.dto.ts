import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO cho thông tin hóa đơn trong báo cáo rice crop
 */
export class RiceCropInvoiceDto {
  @ApiProperty({ description: 'ID hóa đơn' })
  invoice_id!: number;

  @ApiProperty({ description: 'Mã hóa đơn' })
  invoice_code!: string;

  @ApiProperty({ description: 'Ngày tạo hóa đơn' })
  date!: Date;

  @ApiProperty({ description: 'Doanh thu' })
  revenue!: number;

  @ApiProperty({ description: 'Giá vốn' })
  cost!: number;

  @ApiProperty({ description: 'Lợi nhuận' })
  profit!: number;

  @ApiProperty({ description: 'Tỷ suất lợi nhuận (%)' })
  margin!: number;

  @ApiPropertyOptional({ description: 'Tên khách hàng' })
  customer_name?: string;
}

/**
 * DTO cho tổng hợp lợi nhuận rice crop
 */
export class RiceCropProfitSummaryDto {
  @ApiProperty({ description: 'Tổng số hóa đơn' })
  total_invoices!: number;

  @ApiProperty({ description: 'Tổng doanh thu' })
  total_revenue!: number;

  @ApiProperty({ description: 'Tổng giá vốn' })
  total_cost!: number;

  @ApiProperty({ description: 'Tổng lợi nhuận' })
  total_profit!: number;

  @ApiProperty({ description: 'Tỷ suất lợi nhuận trung bình (%)' })
  avg_margin!: number;

  @ApiProperty({ description: 'Tổng giá trị quà tặng từ các đơn hàng' })
  gift_value_from_invoices!: number;
}

/**
 * DTO cho báo cáo lợi nhuận theo rice crop
 */
export class RiceCropProfitReportDto {
  @ApiProperty({ description: 'ID vụ lúa' })
  rice_crop_id!: number;

  @ApiProperty({ description: 'Tên ruộng/lô' })
  field_name!: string;

  @ApiPropertyOptional({ description: 'Tên khách hàng (nông dân)' })
  customer_name?: string;

  @ApiPropertyOptional({ description: 'Tên mùa vụ' })
  season_name?: string;

  @ApiProperty({ description: 'Tổng hợp lợi nhuận', type: RiceCropProfitSummaryDto })
  summary!: RiceCropProfitSummaryDto;

  @ApiProperty({ description: 'Danh sách hóa đơn', type: [RiceCropInvoiceDto] })
  invoices!: RiceCropInvoiceDto[];
}
