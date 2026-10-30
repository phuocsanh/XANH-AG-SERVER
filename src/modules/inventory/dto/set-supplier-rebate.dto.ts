import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, Max, Min } from 'class-validator';

/** Mức chiết khấu NCC cho một dòng nhập, nhập theo đơn vị kho hoặc bao 40 kg. */
export class SetSupplierRebateDto {
  @ApiProperty({ description: 'Mức chiết khấu theo đơn vị đã chọn', example: 10000 })
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  amount!: number;

  @ApiProperty({ enum: ['kg', 'bag40'], description: 'Đơn vị nhập mức chiết khấu' })
  @IsIn(['kg', 'bag40'])
  unit!: 'kg' | 'bag40';
}
