import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryReceipt } from './inventory-receipts.entity';
import { InventoryReceiptItem } from './inventory-receipt-items.entity';
import { SalesInvoice } from './sales-invoices.entity';
import { SalesInvoiceItem } from './sales-invoice-items.entity';
import { SalesReturn } from './sales-return.entity';
import { Product } from './products.entity';
import { Supplier } from './suppliers.entity';

export type InventoryReceiptSupplierSettlementEntryType =
  | 'sale'
  | 'return'
  | 'cancel';

@Entity('inventory_receipt_supplier_settlements')
export class InventoryReceiptSupplierSettlement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'receipt_id' })
  receipt_id!: number;

  @ManyToOne(() => InventoryReceipt, { nullable: false })
  @JoinColumn({ name: 'receipt_id' })
  receipt?: InventoryReceipt;

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

  @Column({ name: 'product_id' })
  product_id!: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'invoice_id', nullable: true })
  invoice_id?: number;

  @ManyToOne(() => SalesInvoice, { nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: SalesInvoice;

  @Column({ name: 'sales_invoice_item_id', nullable: true })
  sales_invoice_item_id?: number;

  @ManyToOne(() => SalesInvoiceItem, { nullable: true })
  @JoinColumn({ name: 'sales_invoice_item_id' })
  sales_invoice_item?: SalesInvoiceItem;

  @Column({ name: 'sales_return_id', nullable: true })
  sales_return_id?: number;

  @ManyToOne(() => SalesReturn, { nullable: true })
  @JoinColumn({ name: 'sales_return_id' })
  sales_return?: SalesReturn;

  @Column({ name: 'entry_type', length: 20 })
  entry_type!: InventoryReceiptSupplierSettlementEntryType;

  @Column({ name: 'price_type', length: 20, nullable: true })
  price_type?: string;

  @Column({ name: 'quantity', type: 'decimal', precision: 15, scale: 4 })
  quantity!: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 15, scale: 2 })
  unit_cost!: number;

  @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
