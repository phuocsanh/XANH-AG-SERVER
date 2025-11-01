import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO cho dữ liệu giá lúa gạo
 */
export class PriceDataDto {
  @ApiProperty({
    description: 'Giá lúa tươi',
    example: '6.800 - 7.200 đồng/kg',
  })
  fresh_rice!: string;

  @ApiProperty({
    description: 'Giá gạo xuất khẩu',
    example: '580 - 620 USD/tấn',
  })
  export_rice!: string;

  @ApiProperty({
    description: 'Giá gạo trong nước',
    example: '18.000 - 22.000 đồng/kg',
  })
  domestic_rice!: string;

  @ApiProperty({
    description: 'Xu hướng giá',
    enum: ['tăng', 'giảm', 'ổn định'],
    example: 'tăng',
  })
  trend!: 'tăng' | 'giảm' | 'ổn định';
}

/**
 * DTO cho thông tin giống lúa
 */
export class RiceVarietyDto {
  @ApiProperty({ description: 'Tên giống lúa', example: 'ST25' })
  variety!: string;

  @ApiProperty({ description: 'Giá cụ thể', example: '9.200 đồng/kg' })
  price!: string;

  @ApiProperty({ description: 'Tỉnh thành', example: 'Sóc Trăng' })
  province!: string;
}

/**
 * DTO cho kết quả phân tích AI về thị trường lúa gạo
 */
export class AnalysisResponseDto {
  @ApiProperty({ description: 'Tóm tắt tình hình thị trường' })
  summary!: string;

  @ApiProperty({
    description: 'Dữ liệu giá cả (tùy chọn)',
    type: PriceDataDto,
    required: false,
  })
  price_data?: PriceDataDto;

  @ApiProperty({
    description: 'Danh sách các giống lúa và giá',
    type: [RiceVarietyDto],
  })
  rice_varieties!: RiceVarietyDto[];

  @ApiProperty({
    description: 'Những thông tin quan trọng về thị trường',
    type: [String],
  })
  market_insights!: string[];

  @ApiProperty({
    description: 'Thời gian cập nhật cuối',
    example: '2024-01-15 10:30:00',
  })
  last_updated!: string;
}
