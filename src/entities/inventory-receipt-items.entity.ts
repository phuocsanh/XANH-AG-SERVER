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

  /** Tên đơn vị tính tại thời điểm nhập (snapshot) */
  @Column({ name: 'unit_name', nullable: true })
  unit_name?: string;

  /** Phí vận chuyển riêng cho sản phẩm này (tùy chọn) */
  @Column({ name: 'individual_shipping_cost', type: 'decimal', precision: 15, scale: 2, default: 0 })
  individual_shipping_cost?: number;

  /** Phí vận chuyển được phân bổ từ phí chung */
  @Column({ name: 'allocated_shipping_cost', type: 'decimal', precision: 15, scale: 2, default: 0 })
  allocated_shipping_cost?: number;

  /** Giá vốn cuối cùng (bao gồm phí vận chuyển) */
  @Column({ name: 'final_unit_cost', type: 'decimal', precision: 15, scale: 2, nullable: true })
  final_unit_cost?: number;

  /** Hạn sử dụng của sản phẩm (nếu có) */
  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  expiry_date?: Date;

  /** Số lô hàng được cấp sau khi nhập kho */
  @Column({ name: 'batch_number', nullable: true })
  batch_number?: string;

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
