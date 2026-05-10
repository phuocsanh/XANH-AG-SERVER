import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class UpdateTaxRevenueCutoverDateDto {
  @ApiProperty({
    description: 'Ngày cutover cho report khai thuế',
    example: '2026-01-01',
  })
  @IsDateString()
  cutover_date!: string;
}

export class TaxRevenueCutoverDateDto {
  @ApiProperty({
    description: 'Ngày cutover cho report khai thuế',
    example: '2026-01-01',
  })
  cutover_date!: string;
}
