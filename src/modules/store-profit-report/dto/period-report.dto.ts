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

export class PeriodInvoiceItemDto {
  @ApiProperty({ description: 'Tên sản phẩm' })
  product_name!: string;

  @ApiProperty({ description: 'Số lượng' })
  quantity!: number;

  @ApiProperty({ description: 'Đơn vị tính' })
  unit_name!: string;

  @ApiProperty({ description: 'Đơn giá' })
  unit_price!: number;

  @ApiProperty({ description: 'Thành tiền' })
  total_price!: number;

  @ApiProperty({ description: 'Có hóa đơn đầu vào hay không' })
  has_input_invoice!: boolean;
  
  @ApiProperty({ description: 'Số lượng có hóa đơn đầu vào' })
  taxable_quantity!: number;

  @ApiProperty({ description: 'Giá bán khai thuế (GBKT)' })
  tax_selling_price!: number;

  @ApiProperty({ description: 'Thành tiền khai thuế (TTKT)' })
  taxable_total_amount!: number;
}

export class PeriodInvoiceDto {
  @ApiProperty({ description: 'ID hóa đơn' })
  invoice_id!: number;

  @ApiProperty({ description: 'Mã hóa đơn' })
  invoice_code!: string;

  @ApiProperty({ description: 'Tên khách hàng' })
  customer_name!: string;

  @ApiProperty({ description: 'Ngày bán' })
  sale_date!: Date;

  @ApiProperty({ description: 'Tổng tiền' })
  total_amount!: number;

  @ApiProperty({ description: 'Danh sách sản phẩm', type: [PeriodInvoiceItemDto] })
  items!: PeriodInvoiceItemDto[];
}

export class PeriodReportDto {
  @ApiProperty({ description: 'Thông tin tổng hợp' })
  summary!: PeriodSummaryDto;

  @ApiProperty({ description: 'Danh sách hóa đơn', type: [PeriodInvoiceDto] })
  invoices!: PeriodInvoiceDto[];

  @ApiProperty({ description: 'Ngày bắt đầu' })
  start_date!: Date;

  @ApiProperty({ description: 'Ngày kết thúc' })
  end_date!: Date;
}
