import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { SalesInvoiceItem } from './sales-invoice-items.entity';

/**
 * Enum định nghĩa các trạng thái của hóa đơn bán hàng
 */
export enum SalesInvoiceStatus {
  DRAFT = 'draft',           // Bản nháp
  CONFIRMED = 'confirmed',   // Đã xác nhận
  PAID = 'paid',            // Đã thanh toán
  CANCELLED = 'cancelled',   // Đã hủy
  REFUNDED = 'refunded',    // Đã hoàn tiền
}

/**
 * Entity biểu diễn thông tin hóa đơn bán hàng
 * Ánh xạ với bảng 'sales_invoice' trong cơ sở dữ liệu
 */
@Entity('sales_invoices')
export class SalesInvoice {
  /** ID duy nhất của hóa đơn bán hàng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã hóa đơn bán hàng (duy nhất) */
  @Column({ name: 'invoice_code', unique: true })
  invoiceCode!: string;

  /** Tên khách hàng */
  @Column({ name: 'customer_name' })
  customerName!: string;

  /** Số điện thoại khách hàng */
  @Column({ name: 'customer_phone', nullable: true })
  customerPhone?: string;

  /** Email khách hàng */
  @Column({ name: 'customer_email', nullable: true })
  customerEmail?: string;

  /** Địa chỉ khách hàng */
  @Column({ name: 'customer_address', nullable: true })
  customerAddress?: string;

  /** Tổng số tiền của hóa đơn */
  @Column({ name: 'total_amount' })
  totalAmount!: number;

  /** Số tiền giảm giá */
  @Column({ name: 'discount_amount', default: 0 })
  discountAmount!: number;

  /** Số tiền cuối cùng sau khi giảm giá */
  @Column({ name: 'final_amount' })
  finalAmount!: number;

  /** Phương thức thanh toán */
  @Column({ name: 'payment_method' })
  paymentMethod!: string;

  /** Trạng thái thanh toán */
  @Column({ name: 'payment_status', default: 'pending' })
  paymentStatus!: string;

  /** Ghi chú */
  @Column({ name: 'notes', nullable: true })
  notes?: string;

  /** ID người tạo hóa đơn */
  @Column({ name: 'created_by_user_id' })
  createdByUserId!: number;

  /** Trạng thái hóa đơn */
  @Column({
    type: 'enum',
    enum: SalesInvoiceStatus,
    default: SalesInvoiceStatus.DRAFT,
  })
  status!: SalesInvoiceStatus;

  /** Thời gian tạo */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Ngày xóa mềm (null nếu chưa bị xóa) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  /** Danh sách các item trong hóa đơn */
  @OneToMany(() => SalesInvoiceItem, (item) => item.invoice)
  items?: SalesInvoiceItem[];
}