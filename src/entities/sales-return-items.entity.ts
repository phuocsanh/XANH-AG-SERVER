import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SalesReturn } from './sales-return.entity';
import { Product } from './products.entity';

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

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column()
  quantity!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  unit_price!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total_price!: number;
}
