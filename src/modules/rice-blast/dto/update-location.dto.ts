import { IsString, IsNumber, IsNotEmpty, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO để cập nhật vị trí ruộng lúa
 */
export class UpdateLocationDto {
  @ApiProperty({ 
    description: 'Tên vị trí ruộng lúa', 
    example: 'Ruộng nhà ông Tư - Tân Lập, Vũ Thư' 
  })
  @IsString()
  @IsNotEmpty({ message: 'Tên vị trí không được để trống' })
  name!: string;

  @ApiProperty({ 
    description: 'Vĩ độ (latitude)', 
    example: 20.4167,
    minimum: -90,
    maximum: 90
  })
  @IsNumber({}, { message: 'Vĩ độ phải là số' })
  @Min(-90, { message: 'Vĩ độ phải >= -90' })
  @Max(90, { message: 'Vĩ độ phải <= 90' })
  lat!: number;

  @ApiProperty({ 
    description: 'Kinh độ (longitude)', 
    example: 106.3667,
    minimum: -180,
    maximum: 180
  })
  @IsNumber({}, { message: 'Kinh độ phải là số' })
  @Min(-180, { message: 'Kinh độ phải >= -180' })
  @Max(180, { message: 'Kinh độ phải <= 180' })
  lon!: number;
}
