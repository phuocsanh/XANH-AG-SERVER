import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Payment } from './payment.entity';
import { SalesInvoice } from './sales-invoices.entity';
import { DebtNote } from './debt-note.entity';

/**
 * Entity phân bổ thanh toán
 * Ánh xạ với bảng 'payment_allocations' trong cơ sở dữ liệu
 */
@Entity('payment_allocations')
export class PaymentAllocation {
  /** ID duy nhất */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID phiếu thu */
  @Column({ name: 'payment_id' })
  payment_id!: number;

  /** Thông tin phiếu thu */
  @ManyToOne(() => Payment, (payment) => payment.allocations)
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;

  /** Loại phân bổ */
  @Column({
    name: 'allocation_type',
    type: 'enum',
    enum: ['invoice', 'debt_note'],
    default: 'debt_note',
  })
  allocation_type!: 'invoice' | 'debt_note';

  /** ID hóa đơn (nếu phân bổ cho hóa đơn) */
  @Column({ name: 'invoice_id', nullable: true })
  invoice_id?: number;

  /** Thông tin hóa đơn */
  @ManyToOne(() => SalesInvoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice?: SalesInvoice;

  /** ID phiếu công nợ (nếu phân bổ cho công nợ) */
  @Column({ name: 'debt_note_id', nullable: true })
  debt_note_id?: number;

  /** Thông tin phiếu công nợ */
  @ManyToOne(() => DebtNote)
  @JoinColumn({ name: 'debt_note_id' })
  debt_note?: DebtNote;

  /** Số tiền phân bổ */
  @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  /** Ngày phân bổ */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
