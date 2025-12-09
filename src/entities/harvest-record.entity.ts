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

/**
 * Enum trạng thái thanh toán
 */
export enum PaymentStatus {
  PENDING = 'pending',   // Chưa thanh toán
  PARTIAL = 'partial',   // Thanh toán một phần
  PAID = 'paid',         // Đã thanh toán đủ
}

/**
 * Entity biểu diễn thông tin thu hoạch và doanh thu
 * Ánh xạ với bảng 'harvest_records' trong cơ sở dữ liệu
 */
@Entity('harvest_records')
export class HarvestRecord {
  @ApiProperty({ description: 'ID duy nhất', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ description: 'ID mảnh ruộng', example: 1 })
  @Column({ name: 'rice_crop_id' })
  rice_crop_id!: number;

  @ManyToOne(() => RiceCrop)
  @JoinColumn({ name: 'rice_crop_id' })
  rice_crop?: RiceCrop;

  @ApiProperty({ description: 'Ngày thu hoạch', example: '2025-02-18' })
  @Column({ name: 'harvest_date', type: 'date' })
  harvest_date!: Date;

  @ApiProperty({ description: 'Năng suất (kg)', example: 3000 })
  @Column({ name: 'yield_amount', type: 'decimal', precision: 10, scale: 2 })
  yield_amount!: number;

  @ApiProperty({ description: 'Độ ẩm (%)', example: 14.5, required: false })
  @Column({ name: 'moisture_content', type: 'decimal', precision: 5, scale: 2, nullable: true })
  moisture_content?: number;

  @ApiProperty({ description: 'Chất lượng', example: 'A' })
  @Column({ name: 'quality_grade', length: 10 })
  quality_grade!: string;

  @ApiProperty({ description: 'Giá bán/kg', example: 8000 })
  @Column({ name: 'selling_price_per_unit', type: 'decimal', precision: 15, scale: 2 })
  selling_price_per_unit!: number;

  @ApiProperty({ description: 'Tổng doanh thu', example: 24000000 })
  @Column({ name: 'total_revenue', type: 'decimal', precision: 15, scale: 2 })
  total_revenue!: number;

  @ApiProperty({ description: 'Người mua/Thương lái', required: false })
  @Column({ name: 'buyer', length: 255, nullable: true })
  buyer?: string;

  @ApiProperty({ 
    description: 'Trạng thái thanh toán', 
    enum: PaymentStatus,
    example: PaymentStatus.PAID 
  })
  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  payment_status!: PaymentStatus;

  @ApiProperty({ description: 'Ngày thanh toán', required: false })
  @Column({ name: 'payment_date', type: 'date', nullable: true })
  payment_date?: Date;

  @ApiProperty({ description: 'Ghi chú', required: false })
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @ApiProperty({ description: 'Thời gian tạo' })
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
