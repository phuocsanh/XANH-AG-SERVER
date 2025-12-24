import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SalesInvoiceItem } from './sales-invoice-items.entity';
import { Season } from './season.entity';
import { Customer } from './customer.entity';
import { RiceCrop } from './rice-crop.entity';
import { User } from './users.entity';
import { DeliveryLog } from './delivery-log.entity';

/**
 * Enum định nghĩa các trạng thái của hóa đơn bán hàng
 */
export enum SalesInvoiceStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum SalesPaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
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

  /** ID khách hàng (nullable - cho phép khách vãng lai) */
  @Column({ name: 'customer_id', nullable: true })
  customer_id?: number;

  /** Thông tin khách hàng (nếu có trong hệ thống) */
  @ManyToOne(() => Customer, (customer) => customer.invoices)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  /** Tên khách hàng (bắt buộc - dùng cho cả khách vãng lai và snapshot) */
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
  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: SalesPaymentStatus,
    default: SalesPaymentStatus.PENDING,
  })
  payment_status!: SalesPaymentStatus;

  /** Ghi chú */
  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes?: string;

  /** Lưu ý quan trọng (warning/alert) */
  @Column({ name: 'warning', nullable: true, type: 'text' })
  warning?: string;

  /** Số tiền đã thanh toán (cho trường hợp bán thiếu) */
  @Column({ name: 'partial_payment_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  partial_payment_amount!: number;

  /** Số tiền còn nợ */
  @Column({ name: 'remaining_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  remaining_amount!: number;

  /** ID mùa vụ */
  @Column({ name: 'season_id', nullable: true })
  season_id?: number;

  /** Thông tin mùa vụ */
  @ManyToOne(() => Season, (season) => season.invoices)
  @JoinColumn({ name: 'season_id' })
  season?: Season;

  /** ID mảnh ruộng (nullable - để biết chi phí cho ruộng nào) */
  @Column({ name: 'rice_crop_id', nullable: true })
  rice_crop_id?: number;

  /** Thông tin vụ lúa */
  @ManyToOne(() => RiceCrop)
  @JoinColumn({ name: 'rice_crop_id' })
  rice_crop?: RiceCrop;

  /** ID người tạo hóa đơn */
  @Column({ name: 'created_by' })
  created_by!: number;

  /** Thông tin người tạo */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  /** Trạng thái hóa đơn */
  @Column({
    name: 'status',
    type: 'enum',
    enum: SalesInvoiceStatus,
    default: SalesInvoiceStatus.DRAFT,
  })
  status!: SalesInvoiceStatus;

  /** Tổng giá vốn hàng bán (Cost of Goods Sold) */
  @Column({ 
    name: 'cost_of_goods_sold', 
    type: 'decimal', 
    precision: 15, 
    scale: 2, 
    default: 0 
  })
  cost_of_goods_sold!: number;

  /** Lợi nhuận gộp (Gross Profit) = final_amount - cost_of_goods_sold */
  @Column({ 
    name: 'gross_profit', 
    type: 'decimal', 
    precision: 15, 
    scale: 2, 
    default: 0 
  })
  gross_profit!: number;

  /** Tỷ suất lợi nhuận gộp (%) */
  @Column({ 
    name: 'gross_profit_margin', 
    type: 'decimal', 
    precision: 5, 
    scale: 2, 
    default: 0 
  })
  gross_profit_margin!: number;

  /** Mô tả quà tặng (tặng gì cho khách hàng) */
  @Column({ 
    name: 'gift_description', 
    type: 'text', 
    nullable: true,
    comment: 'Mô tả quà tặng: VD "1 thùng nước ngọt Coca", "2 bao phân NPK"'
  })
  gift_description?: string;

  /** Giá trị quà tặng cho khách hàng (tặng ngay khi bán) */
  @Column({ 
    name: 'gift_value', 
    type: 'decimal', 
    precision: 10, 
    scale: 2, 
    default: 0,
    comment: 'Giá trị quà tặng quy đổi ra tiền, trừ vào lợi nhuận'
  })
  gift_value!: number;

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

  /** Danh sách các phiếu giao hàng của hóa đơn này */
  @OneToMany(() => DeliveryLog, (log) => log.invoice)
  delivery_logs?: DeliveryLog[];
}
