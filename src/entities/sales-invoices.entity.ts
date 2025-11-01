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
  DRAFT = 'draft', // Bản nháp
  CONFIRMED = 'confirmed', // Đã xác nhận
  PAID = 'paid', // Đã thanh toán
  CANCELLED = 'cancelled', // Đã hủy
  REFUNDED = 'refunded', // Đã hoàn tiền
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
  @Column({ name: 'code', unique: true })
  code!: string;

  /** Tên khách hàng */
  @Column({ name: 'customer_name' })
  customer_name!: string;

  /** Số điện thoại khách hàng */
  @Column({ name: 'customer_phone', nullable: true })
  customer_phone?: string;

  /** Email khách hàng */
  @Column({ name: 'customer_email', nullable: true })
  customer_email?: string;

  /** Địa chỉ khách hàng */
  @Column({ name: 'customer_address', nullable: true })
  customer_address?: string;

  /** Tổng số tiền của hóa đơn */
  @Column({ name: 'total_amount' })
  total_amount!: number;

  /** Số tiền giảm giá */
  @Column({ name: 'discount_amount', default: 0 })
  discount_amount!: number;

  /** Số tiền cuối cùng sau khi giảm giá */
  @Column({ name: 'final_amount' })
  final_amount!: number;

  /** Phương thức thanh toán */
  @Column({ name: 'payment_method' })
  payment_method!: string;

  /** Trạng thái thanh toán */
  @Column({ name: 'payment_status', default: 'pending' })
  payment_status!: string;

  /** Ghi chú */
  @Column({ name: 'notes', nullable: true })
  notes?: string;

  /** ID người tạo hóa đơn */
  @Column({ name: 'created_by' })
  created_by!: number;

  /** Trạng thái hóa đơn */
  @Column({
    name: 'status',
    type: 'enum',
    enum: SalesInvoiceStatus,
    default: SalesInvoiceStatus.DRAFT,
  })
  status!: SalesInvoiceStatus;

  /** Thời gian tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Ngày xóa mềm (null nếu chưa bị xóa) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  /** Danh sách các item trong hóa đơn */
  @OneToMany(() => SalesInvoiceItem, (item) => item.invoice)
  items?: SalesInvoiceItem[];
}
