import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO cho thống kê giao hàng
 */
export class DeliveryStatsDto {
  @ApiProperty({ description: 'Tổng số chuyến giao hàng', example: 150 })
  total_deliveries!: number;

  @ApiProperty({ description: 'Tổng chi phí giao hàng', example: 15000000 })
  total_delivery_cost!: number;

  @ApiProperty({ description: 'Chi phí trung bình/chuyến', example: 100000 })
  avg_cost_per_delivery!: number;

  @ApiProperty({ description: 'Tổng quãng đường (km)', example: 4500, required: false })
  total_distance?: number | undefined;

  @ApiProperty({ description: 'Chi phí/km', example: 3333, required: false })
  cost_per_km?: number | undefined;
}

/**
 * DTO cho chi phí vận hành theo loại
 */
export class OperatingCostBreakdownDto {
  @ApiProperty({ description: 'Loại chi phí', example: 'salary' })
  type!: string;

  @ApiProperty({ description: 'Tên chi phí', example: 'Lương nhân viên' })
  name!: string;

  @ApiProperty({ description: 'Số tiền', example: 15000000 })
  amount!: number;
}

/**
 * DTO cho top khách hàng theo lợi nhuận
 */
export class TopCustomerProfitDto {
  @ApiProperty({ description: 'ID khách hàng', example: 5 })
  customer_id!: number;

  @ApiProperty({ description: 'Tên khách hàng', example: 'Nguyễn Văn A' })
  customer_name!: string;

  @ApiProperty({ description: 'Số đơn hàng', example: 25 })
  total_invoices!: number;

  @ApiProperty({ description: 'Tổng doanh thu', example: 50000000 })
  total_revenue!: number;

  @ApiProperty({ description: 'Tổng lợi nhuận', example: 10000000 })
  total_profit!: number;

  @ApiProperty({ description: 'Tỷ suất lợi nhuận trung bình (%)', example: 20 })
  avg_margin!: number;
}

/**
 * DTO cho top sản phẩm theo lợi nhuận
 */
export class TopProductProfitDto {
  @ApiProperty({ description: 'ID sản phẩm', example: 10 })
  product_id!: number;

  @ApiProperty({ description: 'Tên sản phẩm', example: 'Phân DAP' })
  product_name!: string;

  @ApiProperty({ description: 'Số lượng bán', example: 500 })
  quantity_sold!: number;

  @ApiProperty({ description: 'Tổng doanh thu', example: 75000000 })
  total_revenue!: number;

  @ApiProperty({ description: 'Tổng lợi nhuận', example: 15000000 })
  total_profit!: number;

  @ApiProperty({ description: 'Tỷ suất lợi nhuận (%)', example: 20 })
  margin!: number;
}

/**
 * DTO cho tổng hợp lợi nhuận
 */
export class ProfitSummaryDto {
  @ApiProperty({ description: 'Tổng số đơn hàng', example: 150 })
  total_invoices!: number;

  @ApiProperty({ description: 'Tổng số khách hàng', example: 45 })
  total_customers!: number;

  @ApiProperty({ description: 'Tổng doanh thu', example: 450000000 })
  total_revenue!: number;

  @ApiProperty({ description: 'Tổng giá vốn hàng bán', example: 360000000 })
  cost_of_goods_sold!: number;

  @ApiProperty({ description: 'Lợi nhuận gộp', example: 90000000 })
  gross_profit!: number;

  @ApiProperty({ description: 'Tỷ suất lợi nhuận gộp (%)', example: 20 })
  gross_margin!: number;

  @ApiProperty({ description: 'Tổng chi phí giao hàng', example: 5000000 })
  delivery_costs!: number;

  @ApiProperty({ description: 'Tổng chi phí dịch vụ/quà tặng', example: 45000000 })
  farm_service_costs!: number;

  @ApiProperty({ description: 'Chi phí dịch vụ (máy bay, công thợ...)' })
  service_costs!: number;

  @ApiProperty({ description: 'Chi phí quà tặng tri ân' })
  gift_costs!: number;

  @ApiProperty({ description: 'Tổng chi phí vận hành cửa hàng (điện, nước, mặt bằng...)', example: 10000000 })
  operating_costs!: number;

  @ApiProperty({ description: 'Lợi nhuận ròng', example: 45000000 })
  net_profit!: number;

  @ApiProperty({ description: 'Tỷ suất lợi nhuận ròng (%)', example: 10 })
  net_margin!: number;
}

/**
 * DTO cho báo cáo lợi nhuận theo Season
 */
export class SeasonStoreProfitDto {
  @ApiProperty({ description: 'ID mùa vụ', example: 1 })
  season_id!: number;

  @ApiProperty({ description: 'Tên mùa vụ', example: 'Đông Xuân 2024' })
  season_name!: string;

  @ApiProperty({ 
    description: 'Thời gian',
    example: { start_date: '2024-01-01', end_date: '2024-12-31' }
  })
  period!: {
    start_date?: Date | undefined;
    end_date?: Date | undefined;
  };

  @ApiProperty({ description: 'Tổng hợp lợi nhuận', type: ProfitSummaryDto })
  summary!: ProfitSummaryDto;

  @ApiProperty({ description: 'Chi tiết chi phí dịch vụ/quà tặng', type: [OperatingCostBreakdownDto] })
  farm_service_costs_breakdown!: OperatingCostBreakdownDto[];

  @ApiProperty({ description: 'Chi tiết chi phí vận hành cửa hàng', type: [OperatingCostBreakdownDto] })
  operating_costs_breakdown!: OperatingCostBreakdownDto[];

  @ApiProperty({ description: 'Thống kê giao hàng', type: DeliveryStatsDto, required: false })
  delivery_stats?: DeliveryStatsDto | undefined;

  @ApiProperty({ description: 'Top khách hàng theo lợi nhuận', type: [TopCustomerProfitDto] })
  top_customers!: TopCustomerProfitDto[];

  @ApiProperty({ description: 'Top sản phẩm theo lợi nhuận', type: [TopProductProfitDto] })
  top_products!: TopProductProfitDto[];

  @ApiProperty({ description: 'Debug version string', required: false })
  debug_version?: string;
}
