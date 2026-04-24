import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { RiceCrop } from './rice-crop.entity';
import { ActivityType } from './farming-schedule.entity';

/**
 * Interface cho sản phẩm đã sử dụng
 */
export interface ApplicationProduct {
  product_id: number;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

/**
 * Entity biểu diễn nhật ký phun thuốc/bón phân
 * Ánh xạ với bảng 'application_records' trong cơ sở dữ liệu
 */
@Entity('application_records')
export class ApplicationRecord {
  @ApiProperty({ description: 'ID duy nhất', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ description: 'ID mảnh ruộng', example: 1 })
  @Column({ name: 'rice_crop_id' })
  rice_crop_id!: number;

  @ManyToOne(() => RiceCrop)
  @JoinColumn({ name: 'rice_crop_id' })
  rice_crop?: RiceCrop;

  @ApiProperty({ description: 'ID lịch canh tác (nếu có)', required: false })
  @Column({ name: 'farming_schedule_id', nullable: true })
  farming_schedule_id?: number;

  @ApiProperty({ 
    description: 'Loại hoạt động', 
    enum: ActivityType,
    example: ActivityType.SPRAYING 
  })
  @Column({
    name: 'activity_type',
    type: 'enum',
    enum: ActivityType,
  })
  activity_type!: ActivityType;

  @ApiProperty({ description: 'Ngày thực hiện', example: '2024-12-05' })
  @Column({ name: 'application_date', type: 'date' })
  application_date!: Date;

  @ApiProperty({ description: 'Thời gian thực hiện', example: '6:30 sáng', required: false })
  @Column({ name: 'application_time', length: 100, nullable: true })
  application_time?: string;

  @ApiProperty({ description: 'Danh sách sản phẩm đã sử dụng', type: 'array' })
  @Column({ name: 'products', type: 'jsonb' })
  products!: ApplicationProduct[];

  @ApiProperty({ description: 'Tổng chi phí', example: 500000 })
  @Column({ name: 'total_cost', type: 'decimal', precision: 15, scale: 2 })
  total_cost!: number;

  @ApiProperty({ description: 'Thời tiết lúc thực hiện', required: false })
  @Column({ name: 'weather_condition', length: 255, nullable: true })
  weather_condition?: string;

  @ApiProperty({ description: 'Người thực hiện', required: false })
  @Column({ name: 'operator', length: 255, nullable: true })
  operator?: string;

  @ApiProperty({ description: 'Ghi chú', required: false })
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @ApiProperty({ description: 'Đánh giá hiệu quả (1-5 sao)', required: false })
  @Column({ name: 'effectiveness', type: 'int', nullable: true })
  effectiveness?: number;

  @ApiProperty({ description: 'Tác dụng phụ (nếu có)', required: false })
  @Column({ name: 'side_effects', type: 'text', nullable: true })
  side_effects?: string;

  @ApiProperty({ description: 'Thời gian tạo' })
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
