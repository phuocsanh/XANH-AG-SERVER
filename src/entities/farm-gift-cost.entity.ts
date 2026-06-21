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
import { Product } from './products.entity';
import { InventoryTransaction } from './inventory-transactions.entity';

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

  /** ID sản phẩm được dùng làm quà tặng (nếu lấy từ kho cửa hàng) */
  @Column({ name: 'product_id', nullable: true })
  product_id?: number | null;

  /** Quan hệ Sản phẩm */
  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  /** Tên sản phẩm tại thời điểm tặng */
  @Column({ name: 'product_name', type: 'varchar', length: 255, nullable: true })
  product_name?: string | null;

  /** Số lượng sản phẩm quà */
  @Column({
    name: 'quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value,
      from: (value: string | null) => (value ? parseFloat(value) : null),
    },
  })
  quantity?: number | null;

  /** Đơn giá hạch toán sản phẩm quà */
  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value,
      from: (value: string | null) => (value ? parseFloat(value) : null),
    },
  })
  unit_price?: number | null;

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

  /** ID lịch sử tặng quà (nếu là quà tặng hệ thống chăm sóc KH) */
  @Column({ name: 'reward_history_id', nullable: true })
  reward_history_id?: number;

  /** ID giao dịch kho đã xuất sản phẩm quà */
  @Column({ name: 'inventory_transaction_id', nullable: true })
  inventory_transaction_id?: number | null;

  /** Quan hệ giao dịch kho */
  @ManyToOne(() => InventoryTransaction, { nullable: true })
  @JoinColumn({ name: 'inventory_transaction_id' })
  inventory_transaction?: InventoryTransaction;

  /** Thời gian tạo bản ghi */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật bản ghi */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
