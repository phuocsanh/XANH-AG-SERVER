import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Season } from './season.entity';
import { RiceCrop } from './rice-crop.entity';
import { Customer } from './customer.entity';

/**
 * Entity biểu diễn chi phí dịch vụ/quà tặng của cửa hàng dành cho nông dân
 * Bao gồm: chi phí kỹ thuật, quà tặng, hỗ trợ...
 */
@Entity('farm_service_costs')
export class FarmServiceCost {
  /** ID tự động tăng */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên chi phí/quà tặng (bắt buộc) */
  @Column({ type: 'varchar', nullable: false })
  name!: string;

  /** Số tiền (bắt buộc) */
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: false })
  amount!: number;

  /** ID Mùa vụ (bắt buộc) */
  @Column({ name: 'season_id', nullable: false })
  season_id!: number;

  /** Quan hệ Mùa vụ */
  @ManyToOne(() => Season)
  @JoinColumn({ name: 'season_id' })
  season?: Season;

  /** ID Khách hàng (bắt buộc) */
  @Column({ name: 'customer_id', nullable: false })
  customer_id!: number;

  /** Quan hệ Khách hàng */
  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  /** ID Ruộng lúa (tùy chọn) */
  @Column({ name: 'rice_crop_id', nullable: true })
  rice_crop_id?: number;

  /** Quan hệ Ruộng lúa */
  @ManyToOne(() => RiceCrop)
  @JoinColumn({ name: 'rice_crop_id' })
  rice_crop?: RiceCrop;

  /** Ghi chú */
  @Column({ type: 'text', nullable: true })
  notes?: string;

  /** Ngày phát sinh chi phí */
  @Column({ name: 'expense_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  expense_date!: Date;

  /** Nguồn gốc: manual (nhập tay) hoặc gift_from_invoice (từ quà tặng hóa đơn) */
  @Column({ type: 'varchar', default: 'manual' })
  source!: string;

  /** ID hóa đơn liên quan (nếu là quà tặng từ hóa đơn) */
  @Column({ name: 'invoice_id', nullable: true })
  invoice_id?: number;

  /** Thời gian tạo bản ghi */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật bản ghi */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
