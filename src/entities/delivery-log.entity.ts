import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { SalesInvoice } from './sales-invoices.entity';
import { DeliveryStatus } from '../modules/sales/enums/delivery-status.enum';
import { DeliveryLogItem } from './delivery-log-item.entity';
import { Season } from './season.entity';

/**
 * Entity biểu diễn lịch sử giao hàng
 * Ánh xạ với bảng 'delivery_logs' trong cơ sở dữ liệu
 * Theo dõi chi tiết từng chuyến giao hàng cho khách
 */
@Entity('delivery_logs')
export class DeliveryLog {
  /** ID duy nhất (khóa chính, tự động tăng) */
  @ApiProperty({ description: 'ID duy nhất', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID hóa đơn bán hàng */
  @ApiProperty({ description: 'ID hóa đơn bán hàng', example: 123 })
  @Column({ name: 'invoice_id' })
  invoice_id!: number;

  /** Thông tin hóa đơn */
  @ManyToOne(() => SalesInvoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice?: SalesInvoice;

  /** ID mùa vụ */
  @ApiProperty({ description: 'ID mùa vụ', example: 1, required: false })
  @Column({ name: 'season_id', nullable: true })
  season_id?: number;

  /** Thông tin mùa vụ */
  @ManyToOne(() => Season)
  @JoinColumn({ name: 'season_id' })
  season?: Season;


  /** Ngày giao hàng */
  @ApiProperty({ description: 'Ngày giao hàng', example: '2024-12-01' })
  @Column({ name: 'delivery_date', type: 'date' })
  delivery_date!: Date;

  /** Giờ bắt đầu giao hàng */
  @ApiProperty({ description: 'Giờ bắt đầu giao hàng', example: '08:00:00', required: false })
  @Column({ name: 'delivery_start_time', type: 'time', nullable: true })
  delivery_start_time?: string;

  /** Khoảng cách (km) */
  @ApiProperty({ description: 'Khoảng cách giao hàng (km)', example: 50, required: false })
  @Column({ name: 'distance_km', type: 'decimal', precision: 10, scale: 2, nullable: true })
  distance_km?: number;

  /** Chi phí xăng xe */
  @ApiProperty({ description: 'Chi phí xăng xe', example: 150000 })
  @Column({ name: 'fuel_cost', type: 'decimal', precision: 15, scale: 2, default: 0 })
  fuel_cost!: number;

  /** Chi phí tài xế (nếu thuê ngoài) */
  @ApiProperty({ description: 'Chi phí tài xế', example: 50000, required: false })
  @Column({ name: 'driver_cost', type: 'decimal', precision: 15, scale: 2, default: 0 })
  driver_cost!: number;

  /** Chi phí khác (cầu phà, qua đêm...) */
  @ApiProperty({ description: 'Chi phí khác', example: 20000, required: false })
  @Column({ name: 'other_costs', type: 'decimal', precision: 15, scale: 2, default: 0 })
  other_costs!: number;

  /** Tổng chi phí giao hàng */
  @ApiProperty({ description: 'Tổng chi phí giao hàng', example: 220000 })
  @Column({ name: 'total_cost', type: 'decimal', precision: 15, scale: 2 })
  total_cost!: number;

  /** Tên tài xế */
  @ApiProperty({ description: 'Tên tài xế', example: 'Nguyễn Văn B', required: false })
  @Column({ name: 'driver_name', length: 255, nullable: true })
  driver_name?: string;

  /** Biển số xe */
  @ApiProperty({ description: 'Biển số xe', example: '67A-12345', required: false })
  @Column({ name: 'vehicle_plate', length: 50, nullable: true })
  vehicle_plate?: string;

  /** Địa chỉ giao hàng */
  @ApiProperty({ description: 'Địa chỉ giao hàng', required: false })
  @Column({ name: 'delivery_address', type: 'text', nullable: true })
  delivery_address?: string;

  /** Tên người nhận */
  @ApiProperty({ description: 'Tên người nhận', example: 'Nguyễn Văn A', required: false })
  @Column({ name: 'receiver_name', length: 255, nullable: true })
  receiver_name?: string;

  /** Số điện thoại người nhận */
  @ApiProperty({ description: 'Số điện thoại người nhận', example: '0987654321', required: false })
  @Column({ name: 'receiver_phone', length: 20, nullable: true })
  receiver_phone?: string;

  /** Ghi chú giao hàng */
  @ApiProperty({ description: 'Ghi chú giao hàng', required: false })
  @Column({ name: 'delivery_notes', type: 'text', nullable: true })
  delivery_notes?: string;

  /** Số xe (biển số) */
  @ApiProperty({ description: 'Số xe (biển số)', example: '67A-12345', required: false })
  @Column({ name: 'vehicle_number', length: 50, nullable: true })
  vehicle_number?: string;

  /** Trạng thái giao hàng */
  @ApiProperty({ 
    description: 'Trạng thái giao hàng', 
    example: DeliveryStatus.PENDING,
    enum: DeliveryStatus
  })
  @Column({ 
    name: 'status', 
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING 
  })
  status!: DeliveryStatus;

  /** Ghi chú */
  @ApiProperty({ description: 'Ghi chú', required: false })
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  /** ID người tạo */
  @ApiProperty({ description: 'ID người tạo', example: 1 })
  @Column({ name: 'created_by' })
  created_by!: number;

  /** Thời gian tạo */
  @ApiProperty({ description: 'Thời gian tạo' })
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @ApiProperty({ description: 'Thời gian cập nhật' })
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Danh sách sản phẩm trong phiếu giao hàng */
  @OneToMany(() => DeliveryLogItem, (item) => item.delivery_log)
  items?: DeliveryLogItem[];
}
