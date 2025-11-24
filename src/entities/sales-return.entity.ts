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

export enum SalesReturnStatus {
  DRAFT = 'draft',
  COMPLETED = 'completed',
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

  @ManyToOne(() => SalesInvoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice?: SalesInvoice;

  @Column({ name: 'customer_id', nullable: true })
  customer_id?: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total_refund_amount!: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({
    type: 'enum',
    enum: SalesReturnStatus,
    default: SalesReturnStatus.DRAFT,
  })
  status!: SalesReturnStatus;

  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => SalesReturnItem, (item: SalesReturnItem) => item.sales_return, { cascade: true })
  items?: SalesReturnItem[];
}
