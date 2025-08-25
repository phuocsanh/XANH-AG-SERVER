import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InventoryReceipt } from './inventory-receipt.entity';
import { Product } from './product.entity';

@Entity('inventory_receipt_items')
export class InventoryReceiptItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'receipt_id' })
  receiptId: number;

  @Column({ name: 'product_id' })
  productId: number;

  @Column()
  quantity: number;

  @Column({ name: 'unit_cost' })
  unitCost: number;

  @Column({ name: 'total_price' })
  totalPrice: number;

  @Column({ name: 'notes', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => InventoryReceipt, (receipt) => receipt.id)
  @JoinColumn({ name: 'receipt_id' })
  receipt: InventoryReceipt;

  @ManyToOne(() => Product, (product) => product.id)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
