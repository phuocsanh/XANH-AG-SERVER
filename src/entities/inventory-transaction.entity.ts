import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ name: 'transaction_type' })
  transactionType: string;

  @Column()
  quantity: number;

  @Column({ name: 'unit_cost_price' })
  unitCostPrice: string;

  @Column({ name: 'total_cost_value' })
  totalCostValue: string;

  @Column({ name: 'remaining_quantity' })
  remainingQuantity: number;

  @Column({ name: 'new_average_cost' })
  newAverageCost: string;

  @Column({ name: 'receipt_item_id', nullable: true })
  receiptItemId: number;

  @Column({ name: 'reference_type', nullable: true })
  referenceType: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: number;

  @Column({ name: 'notes', nullable: true })
  notes: string;

  @Column({ name: 'created_by_user_id' })
  createdByUserId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}