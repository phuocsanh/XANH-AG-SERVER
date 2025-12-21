import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { RiceCrop } from './rice-crop.entity';

/**
 * Enum loại hoạt động canh tác
 */
export enum ActivityType {
  SPRAYING = 'spraying',           // Phun thuốc
  FERTILIZING = 'fertilizing',     // Bón phân
  IRRIGATION = 'irrigation',       // Tưới nước
  WEEDING = 'weeding',             // Làm cỏ
  PEST_CONTROL = 'pest_control',   // Phòng trừ sâu bệnh
  OBSERVATION = 'observation',     // Quan sát/kiểm tra
  OTHER = 'other',                 // Khác
}

/**
 * Enum trạng thái lịch
 */
export enum ScheduleStatus {
  PENDING = 'pending',       // Chờ thực hiện
  COMPLETED = 'completed',   // Đã hoàn thành
  CANCELLED = 'cancelled',   // Đã hủy
  OVERDUE = 'overdue',       // Quá hạn
}

/**
 * Entity biểu diễn lịch canh tác
 * Ánh xạ với bảng 'farming_schedules' trong cơ sở dữ liệu
 */
@Entity('farming_schedules')
export class FarmingSchedule {
  @ApiProperty({ description: 'ID duy nhất', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ description: 'ID mảnh ruộng', example: 1 })
  @Column({ name: 'rice_crop_id' })
  rice_crop_id!: number;

  @ManyToOne(() => RiceCrop)
  @JoinColumn({ name: 'rice_crop_id' })
  rice_crop?: RiceCrop;

  @ApiProperty({ 
    description: 'Loại công việc', 
    enum: ActivityType,
    example: ActivityType.SPRAYING 
  })
  @Column({
    name: 'activity_type',
    type: 'enum',
    enum: ActivityType,
  })
  activity_type!: ActivityType;

  @ApiProperty({ description: 'Tên công việc', example: 'Phun thuốc trừ sâu cuốn lá' })
  @Column({ name: 'activity_name', length: 255 })
  activity_name!: string;

  @ApiProperty({ description: 'Ngày dự kiến thực hiện', example: '2024-12-05' })
  @Column({ name: 'scheduled_date', type: 'date' })
  scheduled_date!: Date;

  @ApiProperty({ description: 'Thời gian', example: '6:00 - 9:00 sáng', required: false })
  @Column({ name: 'scheduled_time', length: 100, nullable: true })
  scheduled_time?: string;

  @ApiProperty({ description: 'Danh sách ID sản phẩm dự kiến dùng', type: [Number], required: false })
  @Column({ name: 'product_ids', type: 'jsonb', nullable: true })
  product_ids?: number[];

  @ApiProperty({ description: 'Số lượng ước tính', required: false })
  @Column({ name: 'estimated_quantity', type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimated_quantity?: number;

  @ApiProperty({ description: 'Chi phí ước tính', required: false })
  @Column({ name: 'estimated_cost', type: 'decimal', precision: 15, scale: 2, nullable: true })
  estimated_cost?: number;

  @ApiProperty({ description: 'Hướng dẫn thực hiện', required: false })
  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions?: string;

  @ApiProperty({ description: 'Phụ thuộc thời tiết', example: true })
  @Column({ name: 'weather_dependent', type: 'boolean', default: false })
  weather_dependent!: boolean;

  @ApiProperty({ 
    description: 'Trạng thái', 
    enum: ScheduleStatus,
    example: ScheduleStatus.PENDING 
  })
  @Column({
    name: 'status',
    type: 'enum',
    enum: ScheduleStatus,
    default: ScheduleStatus.PENDING,
  })
  status!: ScheduleStatus;

  @ApiProperty({ description: 'Bật nhắc nhở', example: true })
  @Column({ name: 'reminder_enabled', type: 'boolean', default: false })
  reminder_enabled!: boolean;

  @ApiProperty({ description: 'Thời gian nhắc nhở', required: false })
  @Column({ name: 'reminder_time', type: 'timestamptz', nullable: true })
  reminder_time?: Date;

  @ApiProperty({ description: 'Ngày thực tế đã hoàn thành', example: '2024-12-10', required: false })
  @Column({ name: 'completed_date', type: 'date', nullable: true })
  completed_date?: Date;

  @ApiProperty({ description: 'Thời gian tạo' })
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @ApiProperty({ description: 'Thời gian cập nhật' })
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
