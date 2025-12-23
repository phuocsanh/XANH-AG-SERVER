import { IsOptional, IsNumber, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

/**
 * DTO để tìm kiếm chi phí dịch vụ cho nông dân
 */
export class SearchFarmServiceCostDto extends BaseSearchDto {
  @ApiPropertyOptional({ description: 'ID Mùa vụ', example: 1 })
  @IsOptional()
  @IsNumber()
  season_id?: number;

  @ApiPropertyOptional({ description: 'ID Khách hàng', example: 1 })
  @IsOptional()
  @IsNumber()
  customer_id?: number;

  @ApiPropertyOptional({ description: 'ID Ruộng lúa', example: 1 })
  @IsOptional()
  @IsNumber()
  rice_crop_id?: number;

  @ApiPropertyOptional({ description: 'Nguồn gốc (manual, gift_from_invoice)', example: 'manual' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Từ ngày', example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  override start_date?: string;

  @ApiPropertyOptional({ description: 'Đến ngày', example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  override end_date?: string;
}
