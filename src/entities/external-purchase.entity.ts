import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RiceCrop } from './rice-crop.entity';
import { Customer } from './customer.entity';

/**
 * Entity cho hóa đơn mua hàng từ bên ngoài (nông dân tự nhập)
 */
@Entity('external_purchases')
export class ExternalPurchase {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  rice_crop_id!: number;

  @Column({ type: 'int' })
  customer_id!: number;

  @Column({ type: 'date' })
  purchase_date!: Date;

  @Column({ type: 'varchar', length: 255 })
  supplier_name!: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total_amount!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  paid_amount!: number;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  payment_status!: string;

  @Column({ type: 'int' })
  created_by!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @ManyToOne(() => RiceCrop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rice_crop_id' })
  riceCrop!: RiceCrop;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @OneToMany(() => ExternalPurchaseItem, (item) => item.externalPurchase, {
    cascade: true,
  })
  items!: ExternalPurchaseItem[];
}

/**
 * Entity cho chi tiết sản phẩm trong hóa đơn mua ngoài
 */
@Entity('external_purchase_items')
export class ExternalPurchaseItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  external_purchase_id!: number;

  @Column({ type: 'varchar', length: 255 })
  product_name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  unit_price!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total_price!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Relations
  @ManyToOne(() => ExternalPurchase, (purchase) => purchase.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'external_purchase_id' })
  externalPurchase!: ExternalPurchase;
}
