import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Product } from './products.entity';
import { PromotionCampaign } from './promotion-campaign.entity';
import { SalesInvoice } from './sales-invoices.entity';
import { SalesInvoiceItem } from './sales-invoice-items.entity';

@Entity('customer_promotion_ledger')
export class CustomerPromotionLedger {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'promotion_id' })
  promotion_id!: number;

  @ManyToOne(() => PromotionCampaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' })
  promotion?: PromotionCampaign;

  @Column({ name: 'customer_id' })
  customer_id!: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  @Column({ name: 'order_id' })
  order_id!: number;

  @ManyToOne(() => SalesInvoice)
  @JoinColumn({ name: 'order_id' })
  order?: SalesInvoice;

  @Column({ name: 'order_code', nullable: true })
  order_code?: string;

  @Column({ name: 'order_item_id', nullable: true })
  order_item_id?: number;

  @ManyToOne(() => SalesInvoiceItem)
  @JoinColumn({ name: 'order_item_id' })
  order_item?: SalesInvoiceItem;

  @Column({ name: 'product_id', nullable: true })
  product_id?: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'change_type' })
  change_type!: string;

  @Column({
    name: 'amount_delta',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  amount_delta!: number;

  @Column({
    name: 'quantity_delta',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  quantity_delta!: number;

  @Column({ name: 'source_status', nullable: true })
  source_status?: string;

  @Column({ name: 'reference_type', nullable: true })
  reference_type?: string;

  @Column({ name: 'reference_id', nullable: true })
  reference_id?: number;

  @Column({ name: 'event_at', type: 'timestamptz' })
  event_at!: Date;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
