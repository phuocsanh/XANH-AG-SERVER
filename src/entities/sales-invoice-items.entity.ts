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
import { SalesInvoice } from './sales-invoices.entity';
import { Product } from './products.entity';

/**
 * Entity biểu diễn thông tin chi tiết hóa đơn bán hàng
 * Ánh xạ với bảng 'sales_invoice_item' trong cơ sở dữ liệu
 */
@Entity('sales_invoice_items')
export class SalesInvoiceItem {
  /** ID duy nhất của chi tiết hóa đơn bán hàng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của hóa đơn bán hàng */
  @Column({ name: 'invoice_id' })
  invoice_id!: number;

  /** ID của sản phẩm */
  @Column({ name: 'product_id' })
  product_id!: number;

  /** Số lượng sản phẩm trong hóa đơn */
  @Column({ name: 'quantity' })
  quantity!: number;

  /** Giá đơn vị của sản phẩm */
  @Column({ name: 'unit_price' })
  unit_price!: number;

  /** Số tiền giảm giá cho sản phẩm */
  @Column({ name: 'discount_amount', default: 0 })
  discount_amount!: number;

  /** Tổng giá tiền của sản phẩm */
  @Column({ name: 'total_price' })
  total_price!: number;

  /** Ghi chú về chi tiết hóa đơn */
  @Column({ name: 'notes', nullable: true })
  notes?: string;

  /** Thời gian tạo chi tiết hóa đơn */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất chi tiết hóa đơn bán hàng */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  // Relations
  /** Mối quan hệ nhiều-một với hóa đơn bán hàng */
  @ManyToOne(() => SalesInvoice, (invoice) => invoice.id)
  @JoinColumn({ name: 'invoice_id' })
  invoice!: SalesInvoice;

  /** Mối quan hệ nhiều-một với sản phẩm */
  @ManyToOne(() => Product, (product) => product.id)
  @JoinColumn({ name: 'product_id' })
  product!: Product;
}
