import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
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
  receiptId!: number;

  /** ID của sản phẩm */
  @Column({ name: 'product_id' })
  productId!: number;

  /** Số lượng sản phẩm trong phiếu */
  @Column()
  quantity!: number;

  /** Giá vốn đơn vị của sản phẩm */
  @Column({ name: 'unit_cost' })
  unitCost!: number;

  /** Tổng giá tiền của sản phẩm */
  @Column({ name: 'total_price' })
  totalPrice!: number;

  /** Ghi chú về chi tiết phiếu nhập kho */
  @Column({ name: 'notes', nullable: true })
  notes?: string;

  /** Thời gian tạo chi tiết phiếu nhập kho */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất chi tiết phiếu nhập kho */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

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