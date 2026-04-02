import { ApiProperty } from '@nestjs/swagger';

export class SupplierProductStatDto {
  @ApiProperty()
  product_id!: number;

  @ApiProperty()
  product_code!: string;

  @ApiProperty()
  product_name!: string;

  @ApiProperty()
  quantity_sold!: number;

  @ApiProperty({ required: false })
  unit_name?: string | null;

  @ApiProperty()
  total_revenue!: number;

  @ApiProperty()
  total_cost!: number;

  @ApiProperty()
  profit!: number;

  @ApiProperty()
  margin!: number;
}

export class SupplierStatsSummaryDto {
  @ApiProperty()
  total_revenue!: number;

  @ApiProperty()
  total_cost!: number;

  @ApiProperty()
  gross_profit!: number;

  @ApiProperty()
  gross_margin!: number;

  @ApiProperty()
  product_count!: number;

  @ApiProperty()
  invoice_count!: number;

  @ApiProperty()
  total_purchase_value!: number;

  @ApiProperty({ required: false })
  period?: {
    start_date?: string | null;
    endDate?: string | null;
  };
}

export class SupplierReportDto {
  @ApiProperty()
  supplier_id!: number;

  @ApiProperty()
  supplier_name!: string;

  @ApiProperty()
  summary!: SupplierStatsSummaryDto;

  @ApiProperty({ type: [SupplierProductStatDto] })
  products!: SupplierProductStatDto[];
}
