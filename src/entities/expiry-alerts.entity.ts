import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './products.entity';
import { InventoryBatch } from './inventories.entity';

/**
 * Entity biểu diễn cảnh báo hết hạn sản phẩm
 * Ánh xạ với bảng 'expiry_alerts' trong cơ sở dữ liệu
 */
@Entity('expiry_alerts')
export class ExpiryAlert {
  /** ID duy nhất của cảnh báo (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của sản phẩm */
  @Column({ name: 'product_id' })
  product_id!: number;

  /** Quan hệ với sản phẩm */
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  /** ID của lô hàng */
  @Column({ name: 'batch_id' })
  batch_id!: number;

  /** Quan hệ với lô hàng */
  @ManyToOne(() => InventoryBatch)
  @JoinColumn({ name: 'batch_id' })
  batch?: InventoryBatch;

  /** Ngày hết hạn của lô hàng */
  @Column({ name: 'expiry_date', type: 'date' })
  expiry_date!: Date;

  /** Số lượng còn lại trong lô */
  @Column({ name: 'remaining_quantity' })
  remaining_quantity!: number;

  /** Loại cảnh báo: warning (60-30 ngày), critical (30-0 ngày), expired (đã hết hạn) */
  @Column({ 
    name: 'alert_type',
    type: 'varchar',
    length: 20,
  })
  alert_type!: 'warning' | 'critical' | 'expired';

  /** Số ngày còn lại đến hết hạn (có thể âm nếu đã hết hạn) */
  @Column({ name: 'days_until_expiry' })
  days_until_expiry!: number;

  /** Đã gửi thông báo chưa */
  @Column({ name: 'is_notified', default: false })
  is_notified!: boolean;

  /** Thời gian gửi thông báo */
  @Column({ name: 'notified_at', type: 'timestamp', nullable: true })
  notified_at?: Date;

  /** Đã xử lý chưa (bán hết hoặc hủy) */
  @Column({ name: 'is_resolved', default: false })
  is_resolved!: boolean;

  /** Ghi chú về cách xử lý */
  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolution_notes?: string | null;

  /** Thời gian tạo cảnh báo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
