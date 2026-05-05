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
import { InventoryReceiptItem } from './inventory-receipt-items.entity';

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

  /** ID dòng phiếu nhập gốc dùng để khóa trả hàng theo đúng line nhập */
  @Column({ name: 'receipt_item_id', nullable: true })
  receipt_item_id?: number;

  /** Số lượng sản phẩm trả lại */
  @Column({ name: 'quantity' })
  quantity!: number;

  /** Tên đơn vị trả hàng tại thời điểm lập phiếu */
  @Column({ name: 'unit_name', nullable: true })
  unit_name?: string;

  /** ID đơn vị trả hàng, thường là đơn vị đã nhập trên phiếu nhập gốc */
  @Column({ name: 'unit_id', nullable: true })
  unit_id?: number;

  /** Hệ số quy đổi về đơn vị cơ sở để tác động kho */
  @Column({
    name: 'conversion_factor',
    type: 'decimal',
    precision: 15,
    scale: 6,
    default: 1,
    nullable: true,
  })
  conversion_factor?: number;

  /** Số lượng quy về đơn vị cơ sở dùng để trừ/hoàn kho */
  @Column({
    name: 'base_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  base_quantity?: number;

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

  /** Mối quan hệ nhiều-một với dòng phiếu nhập gốc */
  @ManyToOne(() => InventoryReceiptItem, { nullable: true })
  @JoinColumn({ name: 'receipt_item_id' })
  receipt_item?: InventoryReceiptItem;
}
