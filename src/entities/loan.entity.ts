import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { User } from './users.entity';
import { Payment } from './payment.entity';

export enum LoanStatus {
  ACTIVE = 'active',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'code', unique: true, length: 50 })
  code!: string;

  @Column({ name: 'customer_id' })
  customer_id!: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  @Column({ name: 'loan_date', type: 'date' })
  loan_date!: Date;

  @Column({ name: 'repayment_date', type: 'date', nullable: true })
  repayment_date?: Date | null;

  @Column({ name: 'principal_amount', type: 'decimal', precision: 15, scale: 2 })
  principal_amount!: number;

  @Column({ name: 'monthly_interest_rate', type: 'decimal', precision: 8, scale: 4, default: 0 })
  monthly_interest_rate!: number;

  @Column({ name: 'loan_days', type: 'int', default: 0 })
  loan_days!: number;

  @Column({ name: 'interest_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  interest_amount!: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_amount!: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  paid_amount!: number;

  @Column({ name: 'remaining_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  remaining_amount!: number;

  @Column({ name: 'payment_id', nullable: true })
  payment_id?: number | null;

  @ManyToOne(() => Payment, { nullable: true })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;

  @Column({
    name: 'status',
    type: 'enum',
    enum: LoanStatus,
    enumName: 'loan_status_enum',
    default: LoanStatus.ACTIVE,
  })
  status!: LoanStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @Column({ name: 'settled_by', nullable: true })
  settled_by?: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'settled_by' })
  settler?: User;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
