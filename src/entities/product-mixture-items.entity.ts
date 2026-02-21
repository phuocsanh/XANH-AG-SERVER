import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductMixture } from './product-mixtures.entity';
import { Product } from './products.entity';

/**
 * Chi tiết các nguyên liệu được sử dụng trong một đợt phối trộn cụ thể
 */
@Entity('product_mixture_items')
export class ProductMixtureItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'mixture_id' })
  mixtureId!: number;

  @ManyToOne(() => ProductMixture, (mixture) => mixture.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mixture_id' })
  mixture!: ProductMixture;

  @Column({ name: 'product_id' })
  productId!: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  /** Số lượng nguyên liệu đã dùng */
  @Column({ name: 'quantity', type: 'decimal', precision: 15, scale: 4 })
  quantity!: number;

  /** Giá vốn của nguyên liệu tại thời điểm phối trộn */
  @Column({ name: 'unit_cost', type: 'decimal', precision: 15, scale: 2 })
  unitCost!: number;

  /** Thành tiền = quantity * unitCost */
  @Column({ name: 'total_cost', type: 'decimal', precision: 15, scale: 2 })
  totalCost!: number;
}
