import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SalesInvoice } from './sales-invoices.entity';

/**
 * Enum định nghĩa loại khách hàng
 */
export enum CustomerType {
  REGULAR = 'regular',     // Khách hàng thường
  VIP = 'vip',            // Khách hàng VIP
  WHOLESALE = 'wholesale', // Khách hàng sỉ
}

/**
 * Entity biểu diễn thông tin khách hàng
 * Ánh xạ với bảng 'customers' trong cơ sở dữ liệu
 */
@Entity('customers')
export class Customer {
  /** ID duy nhất của khách hàng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã khách hàng (VD: KH001, KH002) - duy nhất */
  @Column({ name: 'code', unique: true, length: 50 })
  code!: string;

  /** Tên khách hàng */
  @Column({ name: 'name', length: 100 })
  name!: string;

  /** Số điện thoại (duy nhất) */
  @Column({ name: 'phone', unique: true, length: 20 })
  phone!: string;

  /** Email khách hàng */
  @Column({ name: 'email', nullable: true, length: 100 })
  email?: string;

  /** Địa chỉ khách hàng */
  @Column({ name: 'address', nullable: true, type: 'text' })
  address?: string;

  /** Loại khách hàng */
  @Column({
    name: 'type',
    type: 'enum',
    enum: CustomerType,
    default: CustomerType.REGULAR,
  })
  type!: CustomerType;

  /** Đánh dấu khách vãng lai (true nếu là khách vãng lai) */
  @Column({ name: 'is_guest', type: 'boolean', default: false })
  is_guest!: boolean;

  /** Mã số thuế (cho khách hàng doanh nghiệp) */
  @Column({ name: 'tax_code', nullable: true, length: 50 })
  tax_code?: string;

  /** Ghi chú về khách hàng */
  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes?: string;

  /** Tổng số lần mua hàng */
  @Column({ name: 'total_purchases', type: 'int', default: 0 })
  total_purchases!: number;

  /** Tổng số tiền đã chi tiêu */
  @Column({ name: 'total_spent', type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_spent!: number;

  /** Thời gian tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Danh sách hóa đơn của khách hàng */
  @OneToMany(() => SalesInvoice, (invoice) => invoice.customer)
  invoices?: SalesInvoice[];
}
