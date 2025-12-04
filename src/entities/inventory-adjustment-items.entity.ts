import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InventoryAdjustment } from './inventory-adjustments.entity';
import { Product } from './products.entity';

/**
 * Entity biểu diễn thông tin chi tiết phiếu điều chỉnh kho
 * Ánh xạ với bảng 'inventory_adjustment_items' trong cơ sở dữ liệu
 */
@Entity('inventory_adjustment_items')
export class InventoryAdjustmentItem {
  /** ID duy nhất của chi tiết phiếu điều chỉnh kho (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của phiếu điều chỉnh kho */
  @Column({ name: 'adjustment_id' })
  adjustment_id!: number;

  /** ID của sản phẩm */
  @Column({ name: 'product_id' })
  product_id!: number;

  /** Số lượng thay đổi (dương: tăng, âm: giảm) */
  @Column({ name: 'quantity_change' })
  quantity_change!: number;

  /** Lý do điều chỉnh cho sản phẩm này */
  @Column({ name: 'reason', type: 'text', nullable: true })
  reason?: string;

  /** Ghi chú về chi tiết phiếu điều chỉnh kho */
  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes?: string;

  /** Thời gian tạo chi tiết phiếu điều chỉnh kho */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất chi tiết phiếu điều chỉnh kho */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  // Relations
  /** Mối quan hệ nhiều-một với phiếu điều chỉnh kho */
  @ManyToOne(() => InventoryAdjustment, (adjustment) => adjustment.items)
  @JoinColumn({ name: 'adjustment_id' })
  adjustment!: InventoryAdjustment;

  /** Mối quan hệ nhiều-một với sản phẩm */
  @ManyToOne(() => Product, (product) => product.id)
  @JoinColumn({ name: 'product_id' })
  product!: Product;
}
