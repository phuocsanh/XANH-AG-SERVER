import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('inventory_receipts')
export class InventoryReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'receipt_code', unique: true })
  receiptCode: string;

  @Column({ name: 'supplier_name', nullable: true })
  supplierName: string;

  @Column({ name: 'supplier_contact', nullable: true })
  supplierContact: string;

  @Column({ name: 'total_amount' })
  totalAmount: number;

  @Column({ name: 'status', default: 'draft' })
  status: string; // draft, approved, completed, cancelled

  @Column({ name: 'notes', nullable: true })
  notes: string;

  @Column({ name: 'created_by_user_id' })
  createdByUserId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @Column({ name: 'cancelled_at', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'cancelled_reason', nullable: true })
  cancelledReason: string;
}
