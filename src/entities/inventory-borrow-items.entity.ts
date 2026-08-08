import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InventoryBorrow } from './inventory-borrows.entity';
import { Product } from './products.entity';
import { InventoryBatch } from './inventories.entity';
import { InventoryReceiptItem } from './inventory-receipt-items.entity';

@Entity('inventory_borrow_items')
export class InventoryBorrowItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'borrow_id' })
  borrow_id!: number;

  @ManyToOne(() => InventoryBorrow, (borrow) => borrow.items)
  @JoinColumn({ name: 'borrow_id' })
  borrow!: InventoryBorrow;

  @Column({ name: 'product_id' })
  product_id!: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'batch_id' })
  batch_id!: number;

  @ManyToOne(() => InventoryBatch)
  @JoinColumn({ name: 'batch_id' })
  batch?: InventoryBatch;

  @Column({ name: 'receipt_item_id', nullable: true })
  receipt_item_id?: number | null;

  @ManyToOne(() => InventoryReceiptItem, { nullable: true })
  @JoinColumn({ name: 'receipt_item_id' })
  receipt_item?: InventoryReceiptItem | null;

  @Column({
    name: 'quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  quantity!: number;

  @Column({
    name: 'returned_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  returned_quantity!: number;

  @Column({
    name: 'converted_to_sale_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  converted_to_sale_quantity!: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
