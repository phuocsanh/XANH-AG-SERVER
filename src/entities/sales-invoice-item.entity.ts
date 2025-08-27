import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SalesInvoice } from './sales-invoice.entity';
import { Product } from './product.entity';

/**
 * Entity biểu diễn thông tin chi tiết hóa đơn bán hàng
 * Ánh xạ với bảng 'sales_invoice_item' trong cơ sở dữ liệu
 */
@Entity('sales_invoice_item')
export class SalesInvoiceItem {
  /** ID duy nhất của chi tiết hóa đơn bán hàng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id: number;

  /** ID của hóa đơn bán hàng */
  @Column({ name: 'invoice_id' })
  invoiceId: number;

  /** ID của sản phẩm */
  @Column({ name: 'product_id' })
  productId: number;

  /** Số lượng sản phẩm trong hóa đơn */
  @Column()
  quantity: number;

  /** Giá đơn vị của sản phẩm */
  @Column({ name: 'unit_price' })
  unitPrice: number;

  /** Số tiền giảm giá cho sản phẩm */
  @Column({ name: 'discount_amount', default: 0 })
  discountAmount: number;

  /** Tổng giá tiền của sản phẩm */
  @Column({ name: 'total_price' })
  totalPrice: number;

  /** Ghi chú về chi tiết hóa đơn */
  @Column({ name: 'notes', nullable: true })
  notes: string;

  /** Thời gian tạo chi tiết hóa đơn */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** Thời gian cập nhật gần nhất chi tiết hóa đơn */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  /** Mối quan hệ nhiều-một với hóa đơn bán hàng */
  @ManyToOne(() => SalesInvoice, (invoice) => invoice.id)
  @JoinColumn({ name: 'invoice_id' })
  invoice: SalesInvoice;

  /** Mối quan hệ nhiều-một với sản phẩm */
  @ManyToOne(() => Product, (product) => product.id)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}