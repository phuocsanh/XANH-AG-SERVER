import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Entity quản lý vị trí ruộng lúa
 * Chỉ cho phép 1 dòng duy nhất với id = 1
 */
@Entity('locations')
export class Location {
  @ApiProperty({ description: 'ID cố định = 1', example: 1 })
  @PrimaryColumn({ type: 'bigint', default: 1 })
  id!: number;

  @ApiProperty({ 
    description: 'Tên vị trí ruộng lúa', 
    example: 'Ruộng nhà ông Tư - Tân Lập, Vũ Thư' 
  })
  @Column({ type: 'text' })
  name!: string;

  @ApiProperty({ description: 'Vĩ độ (latitude)', example: 20.4167 })
  @Column({ type: 'double precision' })
  lat!: number;

  @ApiProperty({ description: 'Kinh độ (longitude)', example: 106.3667 })
  @Column({ type: 'double precision' })
  lon!: number;

  @ApiProperty({ description: 'Thời điểm cập nhật cuối' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
