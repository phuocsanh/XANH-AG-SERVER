import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { RiceCrop } from './rice-crop.entity';

@Entity('area_of_each_plot_of_land')
export class AreaOfEachPlotOfLand {
  @ApiProperty({ description: 'ID duy nhất', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ description: 'Tên vùng/lô đất', example: 'Lô A1' })
  @Column({ name: 'name', length: 255 })
  name!: string;

  @ApiProperty({ description: 'Mã vùng/lô đất', example: 'LA1' })
  @Column({ name: 'code', length: 50, unique: true })
  code!: string;

  @ApiProperty({ description: 'Diện tích (m2 hoặc đơn vị khác)', example: 1000 })
  @Column({ name: 'acreage', type: 'decimal', precision: 10, scale: 2 })
  acreage!: number;

  @OneToMany(() => RiceCrop, (riceCrop) => riceCrop.areaOfEachPlotOfLand)
  riceCrops?: RiceCrop[];

  @ApiProperty({ description: 'Thời gian tạo' })
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @ApiProperty({ description: 'Thời gian cập nhật' })
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
