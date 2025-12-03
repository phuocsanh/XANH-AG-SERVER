import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO cho yêu cầu báo cáo theo khoảng thời gian
 */
export class DateRangeReportDto {
  @ApiProperty({ description: 'Ngày bắt đầu', example: '2024-01-01' })
  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @ApiProperty({ description: 'Ngày kết thúc', example: '2024-12-31' })
  @IsDate()
  @Type(() => Date)
  endDate!: Date;

  @ApiProperty({ description: 'ID khách hàng (tùy chọn)', required: false })
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @ApiProperty({ description: 'ID mùa vụ (tùy chọn)', required: false })
  @IsOptional()
  @IsNumber()
  seasonId?: number;
}

/**
 * DTO cho yêu cầu so sánh nhiều seasons
 */
export class CompareSeasonsDto {
  @ApiProperty({ description: 'Danh sách ID seasons cần so sánh', example: [1, 2, 3] })
  season_ids!: number[];
}
