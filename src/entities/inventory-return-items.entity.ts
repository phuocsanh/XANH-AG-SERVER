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
import { InventoryReturn } from './inventory-returns.entity';
import { Product } from './products.entity';

/**
 * Entity biểu diễn thông tin chi tiết phiếu xuất trả hàng
 * Ánh xạ với bảng 'inventory_return_items' trong cơ sở dữ liệu
 */
@Entity('inventory_return_items')
export class InventoryReturnItem {
  /** ID duy nhất của chi tiết phiếu xuất trả hàng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của phiếu xuất trả hàng */
  @Column({ name: 'return_id' })
  return_id!: number;

  /** ID của sản phẩm */
  @Column({ name: 'product_id' })
  product_id!: number;

  /** Số lượng sản phẩm trả lại */
  @Column({ name: 'quantity' })
  quantity!: number;

  /** Giá vốn đơn vị của sản phẩm */
  @Column({ name: 'unit_cost', type: 'decimal', precision: 15, scale: 2 })
  unit_cost!: number;

  /** Tổng giá tiền của sản phẩm */
  @Column({ name: 'total_price', type: 'decimal', precision: 15, scale: 2 })
  total_price!: number;

  /** Lý do trả hàng cho sản phẩm này */
  @Column({ name: 'reason', type: 'text', nullable: true })
  reason?: string;

  /** Ghi chú về chi tiết phiếu xuất trả hàng */
  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes?: string;

  /** Thời gian tạo chi tiết phiếu xuất trả hàng */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất chi tiết phiếu xuất trả hàng */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  // Relations
  /** Mối quan hệ nhiều-một với phiếu xuất trả hàng */
  @ManyToOne(() => InventoryReturn, (returnDoc) => returnDoc.items)
  @JoinColumn({ name: 'return_id' })
  return!: InventoryReturn;

  /** Mối quan hệ nhiều-một với sản phẩm */
  @ManyToOne(() => Product, (product) => product.id)
  @JoinColumn({ name: 'product_id' })
  product!: Product;
}
