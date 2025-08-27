import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sales_invoice')
export class SalesInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'invoice_code', unique: true })
  invoiceCode: string;

  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;



  @Column({ name: 'customer_address', nullable: true })
  customerAddress: string;

  @Column({ name: 'total_amount' })
  totalAmount: number;

  @Column({ name: 'discount_amount', default: 0 })
  discountAmount: number;

  @Column({ name: 'final_amount' })
  finalAmount: number;

  @Column({ name: 'payment_method' })
  paymentMethod: string;

  @Column({ name: 'payment_status', default: 'pending' })
  paymentStatus: string;

  @Column({ name: 'notes', nullable: true })
  notes: string;

  @Column({ name: 'created_by_user_id' })
  createdByUserId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
