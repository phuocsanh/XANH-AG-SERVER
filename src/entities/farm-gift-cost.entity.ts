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
 * Entity biểu diễn quà tặng của cửa hàng dành cho nông dân
 * Tách biệt khỏi chi phí dịch vụ để dễ quản lý
 */
@Entity('farm_gift_costs')
export class FarmGiftCost {
  /** ID tự động tăng */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên quà tặng (bắt buộc) */
  @Column({ type: 'varchar', nullable: false })
  name!: string;

  /** Giá trị quà tặng (bắt buộc) */
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

  /** Ngày tặng quà */
  @Column({ name: 'gift_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  gift_date!: Date;

  /** Nguồn gốc: manually_awarded (nhập tay), gift_from_invoice (từ hóa đơn), reward_points (đổi điểm) */
  @Column({ type: 'varchar', default: 'manually_awarded' })
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
