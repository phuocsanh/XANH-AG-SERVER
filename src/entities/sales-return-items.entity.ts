import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SalesReturn } from './sales-return.entity';
import { Product } from './products.entity';
import { SalesInvoiceItem } from './sales-invoice-items.entity';

@Entity('sales_return_items')
export class SalesReturnItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'sales_return_id' })
  sales_return_id!: number;

  @ManyToOne(() => SalesReturn, (salesReturn) => salesReturn.items)
  @JoinColumn({ name: 'sales_return_id' })
  sales_return?: SalesReturn;

  @Column({ name: 'product_id' })
  product_id!: number;

  @Column({ name: 'sales_invoice_item_id', nullable: true })
  sales_invoice_item_id?: number;

  @ManyToOne(() => SalesInvoiceItem, { nullable: true })
  @JoinColumn({ name: 'sales_invoice_item_id' })
  sales_invoice_item?: SalesInvoiceItem;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column()
  quantity!: number;

  @Column({ name: 'unit_name', nullable: true })
  unit_name?: string;

  @Column({ name: 'sale_unit_id', nullable: true })
  sale_unit_id?: number;

  @Column({
    name: 'conversion_factor',
    type: 'decimal',
    precision: 15,
    scale: 6,
    default: 1,
    nullable: true,
  })
  conversion_factor?: number;

  @Column({
    name: 'base_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  base_quantity?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  unit_price!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total_price!: number;
}
