import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { User } from './users.entity';
import { InventoryBorrowItem } from './inventory-borrow-items.entity';

export enum InventoryBorrowStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  PARTIAL_RETURNED = 'partial_returned',
  RETURNED = 'returned',
  CONVERTED_TO_SALE = 'converted_to_sale',
  CANCELLED = 'cancelled',
}

@Entity('inventory_borrows')
export class InventoryBorrow {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'code', unique: true, length: 50 })
  code!: string;

  @Column({ name: 'borrower_customer_id', nullable: true })
  borrower_customer_id?: number | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'borrower_customer_id' })
  borrower_customer?: Customer | null;

  @Column({ name: 'borrower_name' })
  borrower_name!: string;

  @Column({ name: 'borrow_date', type: 'date' })
  borrow_date!: Date;

  @Column({ name: 'expected_return_date', type: 'date', nullable: true })
  expected_return_date?: Date | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: InventoryBorrowStatus,
    enumName: 'inventory_borrow_status_enum',
    default: InventoryBorrowStatus.DRAFT,
  })
  status!: InventoryBorrowStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @Column({ name: 'approved_by', nullable: true })
  approved_by?: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver?: User | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approved_at?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  @OneToMany(() => InventoryBorrowItem, (item) => item.borrow)
  items!: InventoryBorrowItem[];
}
