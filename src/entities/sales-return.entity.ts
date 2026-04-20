import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { SalesInvoice } from './sales-invoices.entity';
import { Customer } from './customer.entity';
import { SalesReturnItem } from './sales-return-items.entity';
import { User } from './users.entity';

export enum SalesReturnStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  CANCELLED = 'cancelled',
}

@Entity('sales_returns')
export class SalesReturn {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column({ name: 'invoice_id' })
  invoice_id!: number;

  @ManyToOne(() => SalesInvoice, (invoice) => invoice.returns)
  @JoinColumn({ name: 'invoice_id' })
  invoice?: SalesInvoice;

  @Column({ name: 'customer_id', nullable: true })
  customer_id?: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total_refund_amount!: number;

  @Column({ 
    type: 'varchar',
    length: 20,
    default: 'debt_credit'
  })
  refund_method!: string; // 'cash' hoặc 'debt_credit'

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    type: 'enum',
    enum: SalesReturnStatus,
    default: SalesReturnStatus.DRAFT,
  })
  status!: SalesReturnStatus;

  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => SalesReturnItem, (item: SalesReturnItem) => item.sales_return, { cascade: true })
  items?: SalesReturnItem[];
}
