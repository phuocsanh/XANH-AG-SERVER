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
import { InventoryReceipt } from './inventory-receipts.entity';
import { Product } from './products.entity';

/**
 * Entity biểu diễn thông tin chi tiết phiếu nhập kho
 * Ánh xạ với bảng 'inventory_receipt_items' trong cơ sở dữ liệu
 */
@Entity('inventory_receipt_items')
export class InventoryReceiptItem {
  /** ID duy nhất của chi tiết phiếu nhập kho (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của phiếu nhập kho */
  @Column({ name: 'receipt_id' })
  receipt_id!: number;

  /** ID của sản phẩm */
  @Column({ name: 'product_id' })
  product_id!: number;

  /** Số lượng sản phẩm trong phiếu */
  @Column({ name: 'quantity' })
  quantity!: number;

  /** Giá vốn đơn vị của sản phẩm */
  @Column({ name: 'unit_cost' })
  unit_cost!: number;

  /** Tổng giá tiền của sản phẩm */
  @Column({ name: 'total_price' })
  total_price!: number;

  /** Ghi chú về chi tiết phiếu nhập kho */
  @Column({ name: 'notes', nullable: true })
  notes?: string;

  /** Thời gian tạo chi tiết phiếu nhập kho */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất chi tiết phiếu nhập kho */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  // Relations
  /** Mối quan hệ nhiều-một với phiếu nhập kho */
  @ManyToOne(() => InventoryReceipt, (receipt) => receipt.id)
  @JoinColumn({ name: 'receipt_id' })
  receipt!: InventoryReceipt;

  /** Mối quan hệ nhiều-một với sản phẩm */
  @ManyToOne(() => Product, (product) => product.id)
  @JoinColumn({ name: 'product_id' })
  product!: Product;
}
