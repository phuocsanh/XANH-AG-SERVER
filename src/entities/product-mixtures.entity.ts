import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Product } from './products.entity';
import { User } from './users.entity';
import { ProductMixtureItem } from './product-mixture-items.entity';

/**
 * Entity ghi lại việc phối trộn sản phẩm (Lệnh sản xuất/đóng gói)
 */
@Entity('product_mixtures')
export class ProductMixture {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã phiếu phối trộn */
  @Column({ name: 'code', unique: true })
  code!: string;

  /** ID sản phẩm mục tiêu (Sản phẩm D) */
  @Column({ name: 'product_id' })
  productId!: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  /** Số lượng thành phẩm tạo ra */
  @Column({ name: 'quantity', type: 'decimal', precision: 15, scale: 2 })
  quantity!: number;

  /** Ngày thực hiện phối trộn */
  @Column({ name: 'mixture_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  mixtureDate!: Date;

  /** Tổng chi phí nguyên liệu */
  @Column({ name: 'total_cost', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCost!: number;

  /** Ghi chú */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  /** Người thực hiện */
  @Column({ name: 'created_by' })
  created_by!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @OneToMany(() => ProductMixtureItem, (item) => item.mixture)
  items!: ProductMixtureItem[];

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
