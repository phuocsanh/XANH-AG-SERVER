import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity biểu diễn thông tin hóa đơn bán hàng
 * Ánh xạ với bảng 'sales_invoice' trong cơ sở dữ liệu
 */
@Entity('sales_invoices')
export class SalesInvoice {
  /** ID duy nhất của hóa đơn bán hàng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id: number;

  /** Mã hóa đơn bán hàng (duy nhất) */
  @Column({ name: 'invoice_code', unique: true })
  invoiceCode: string;

  /** Tên khách hàng */
  @Column({ name: 'customer_name' })
  customerName: string;

  /** Số điện thoại khách hàng */
  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;

  /** Địa chỉ khách hàng */
  @Column({ name: 'customer_address', nullable: true })
  customerAddress: string;

  /** Tổng số tiền của hóa đơn */
  @Column({ name: 'total_amount' })
  totalAmount: number;

  /** Số tiền giảm giá */
  @Column({ name: 'discount_amount', default: 0 })
  discountAmount: number;

  /** Số tiền cuối cùng sau khi giảm giá */
  @Column({ name: 'final_amount' })
  finalAmount: number;

  /** Phương thức thanh toán */
  @Column({ name: 'payment_method' })
  paymentMethod: string;

  /** Trạng thái thanh toán (pending, paid, cancelled) */
  @Column({ name: 'payment_status', default: 'pending' })
  paymentStatus: string;

  /** Ghi chú về hóa đơn */
  @Column({ name: 'notes', nullable: true })
  notes: string;

  /** ID của người dùng tạo hóa đơn */
  @Column({ name: 'created_by_user_id' })
  createdByUserId: number;

  /** Thời gian tạo hóa đơn */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** Thời gian cập nhật gần nhất hóa đơn */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}