import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SalesInvoice } from './sales-invoices.entity';
import { Customer } from './customer.entity';

/** Lưu phần tích lũy đã ghi nhận theo hóa đơn để chỉ cộng/trừ chênh lệch. */
@Entity('customer_reward_invoice_tracking')
export class CustomerRewardInvoiceTracking {
  @PrimaryColumn({ name: 'invoice_id', type: 'int' })
  invoice_id!: number;

  @ManyToOne(() => SalesInvoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice?: SalesInvoice;

  @Column({ name: 'customer_id', type: 'int' })
  customer_id!: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  @Column({ name: 'accumulated_amount', type: 'numeric', precision: 15, scale: 2, default: 0 })
  accumulated_amount!: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
