import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryBatch } from './inventories.entity';
import { InventoryReceiptItem } from './inventory-receipt-items.entity';
import { SalesInvoice } from './sales-invoices.entity';
import { SalesInvoiceItem } from './sales-invoice-items.entity';
import { Product } from './products.entity';
import { Supplier } from './suppliers.entity';

@Entity('sales_invoice_item_stock_allocations')
export class SalesInvoiceItemStockAllocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'invoice_id' })
  invoice_id!: number;

  @ManyToOne(() => SalesInvoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice?: SalesInvoice;

  @Column({ name: 'sales_invoice_item_id' })
  sales_invoice_item_id!: number;

  @ManyToOne(() => SalesInvoiceItem)
  @JoinColumn({ name: 'sales_invoice_item_id' })
  sales_invoice_item?: SalesInvoiceItem;

  @Column({ name: 'product_id' })
  product_id!: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'inventory_batch_id', nullable: true })
  inventory_batch_id?: number;

  @ManyToOne(() => InventoryBatch, { nullable: true })
  @JoinColumn({ name: 'inventory_batch_id' })
  inventory_batch?: InventoryBatch;

  @Column({ name: 'receipt_item_id', nullable: true })
  receipt_item_id?: number;

  @ManyToOne(() => InventoryReceiptItem, { nullable: true })
  @JoinColumn({ name: 'receipt_item_id' })
  receipt_item?: InventoryReceiptItem;

  @Column({ name: 'supplier_id', nullable: true })
  supplier_id?: number;

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier?: Supplier;

  @Column({ name: 'quantity', type: 'decimal', precision: 15, scale: 4 })
  quantity!: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 15, scale: 2 })
  unit_cost!: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 15, scale: 2 })
  total_cost!: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
