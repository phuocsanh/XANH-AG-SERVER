import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('inventory_batches')
export class InventoryBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ name: 'batch_code', nullable: true })
  batchCode: string;

  @Column({ name: 'unit_cost_price' })
  unitCostPrice: string;

  @Column({ name: 'original_quantity' })
  originalQuantity: number;

  @Column({ name: 'remaining_quantity' })
  remainingQuantity: number;

  @Column({ name: 'expiry_date', nullable: true })
  expiryDate: Date;

  @Column({ name: 'receipt_item_id', nullable: true })
  receiptItemId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}