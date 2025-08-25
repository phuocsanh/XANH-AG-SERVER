import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sales_invoices')
export class SalesInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'invoice_code', unique: true })
  invoiceCode: string;

  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;

  @Column({ name: 'customer_email', nullable: true })
  customerEmail: string;

  @Column({ name: 'customer_address', nullable: true })
  customerAddress: string;

  @Column({ name: 'total_amount' })
  totalAmount: number;

  @Column({ name: 'discount_amount', default: 0 })
  discountAmount: number;

  @Column({ name: 'final_amount' })
  finalAmount: number;

  @Column({ name: 'status', default: 'draft' })
  status: string; // draft, confirmed, delivered, completed, cancelled

  @Column({ name: 'notes', nullable: true })
  notes: string;

  @Column({ name: 'created_by_user_id' })
  createdByUserId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'confirmed_at', nullable: true })
  confirmedAt: Date;

  @Column({ name: 'delivered_at', nullable: true })
  deliveredAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @Column({ name: 'cancelled_at', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'cancelled_reason', nullable: true })
  cancelledReason: string;
}
