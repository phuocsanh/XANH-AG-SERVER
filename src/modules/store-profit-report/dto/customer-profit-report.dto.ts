import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO cho thông tin đơn hàng trong báo cáo khách hàng
 */
export class CustomerInvoiceDto {
  @ApiProperty({ description: 'ID hóa đơn', example: 123 })
  invoice_id!: number;

  @ApiProperty({ description: 'Mã hóa đơn', example: 'INV-2024-123' })
  invoice_code!: string;

  @ApiProperty({ description: 'Ngày tạo' })
  date!: Date;

  @ApiProperty({ description: 'Doanh thu', example: 2300000 })
  revenue!: number;

  @ApiProperty({ description: 'Giá vốn', example: 1900000 })
  cost!: number;

  @ApiProperty({ description: 'Lợi nhuận', example: 400000 })
  profit!: number;

  @ApiProperty({ description: 'Tỷ suất lợi nhuận (%)', example: 17.4 })
  margin!: number;

  @ApiProperty({ description: 'ID mùa vụ', required: false })
  season_id?: number | undefined;

  @ApiProperty({ description: 'Tên mùa vụ', required: false })
  season_name?: string | undefined;
}

/**
 * DTO cho tổng hợp theo mùa vụ
 */
export class CustomerSeasonSummaryDto {
  @ApiProperty({ description: 'ID mùa vụ', example: 1 })
  season_id!: number;

  @ApiProperty({ description: 'Tên mùa vụ', example: 'Đông Xuân 2024' })
  season_name!: string;

  @ApiProperty({ description: 'Số đơn hàng', example: 15 })
  total_invoices!: number;

  @ApiProperty({ description: 'Tổng doanh thu', example: 30000000 })
  total_revenue!: number;

  @ApiProperty({ description: 'Tổng giá vốn', example: 24000000 })
  total_cost!: number;

  @ApiProperty({ description: 'Tổng lợi nhuận', example: 6000000 })
  total_profit!: number;

  @ApiProperty({ description: 'Tỷ suất lợi nhuận trung bình (%)', example: 20 })
  avg_margin!: number;
}

/**
 * DTO cho báo cáo lợi nhuận của 1 khách hàng
 */
export class CustomerProfitReportDto {
  @ApiProperty({ description: 'ID khách hàng', example: 5 })
  customer_id!: number;

  @ApiProperty({ description: 'Tên khách hàng', example: 'Nguyễn Văn A' })
  customer_name!: string;

  @ApiProperty({ description: 'Số điện thoại', required: false })
  customer_phone?: string | undefined;

  @ApiProperty({ description: 'Email', required: false })
  customer_email?: string | undefined;

  @ApiProperty({ 
    description: 'Tổng hợp lợi nhuận',
    example: {
      total_invoices: 25,
      total_revenue: 50000000,
      total_cost: 40000000,
      total_profit: 10000000,
      avg_margin: 20.0
    }
  })
  summary!: {
    total_invoices: number;
    total_revenue: number;
    total_cost: number;
    total_profit: number;
    avg_margin: number;
  };

  @ApiProperty({ description: 'Danh sách đơn hàng', type: [CustomerInvoiceDto] })
  invoices!: CustomerInvoiceDto[];

  @ApiProperty({ description: 'Tổng hợp theo mùa vụ', type: [CustomerSeasonSummaryDto] })
  by_season!: CustomerSeasonSummaryDto[];
}
