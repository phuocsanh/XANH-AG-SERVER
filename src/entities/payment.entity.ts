import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Customer } from './customer.entity';
import { PaymentAllocation } from './payment-allocation.entity'; // Import entity phân bổ

/**
 * Entity phiếu thu tiền
 * Ánh xạ với bảng 'payments' trong cơ sở dữ liệu
 */
@Entity('payments')
export class Payment {
  /** ID duy nhất của phiếu thu */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã phiếu thu (PT001, PT002...) - duy nhất */
  @Column({ name: 'code', unique: true, length: 50 })
  code!: string;

  /** ID khách hàng */
  @Column({ name: 'customer_id' })
  customer_id!: number;

  /** Thông tin khách hàng */
  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  /** Số tiền thu */
  @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  /** Số tiền đã phân bổ */
  @Column({ name: 'allocated_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  allocated_amount!: number;

  /** Ngày thu tiền */
  @Column({ name: 'payment_date', type: 'date' })
  payment_date!: Date;

  /** Phương thức thanh toán */
  @Column({ name: 'payment_method', length: 50 })
  payment_method!: string;

  /** Ghi chú */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  /** ID người tạo phiếu */
  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  /** Ngày tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Danh sách phân bổ thanh toán */
  @OneToMany(() => PaymentAllocation, (allocation) => allocation.payment)
  allocations?: PaymentAllocation[];
}
