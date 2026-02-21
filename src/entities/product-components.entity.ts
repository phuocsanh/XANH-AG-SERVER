import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './products.entity';
import { Unit } from './unit.entity';

/**
 * Entity biểu diễn thành phần cấu tạo nên một sản phẩm phối trộn (BOM)
 */
@Entity('product_components')
export class ProductComponent {
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID sản phẩm chính (sản phẩm sau khi phối trộn) */
  @Column({ name: 'product_id' })
  productId!: number;

  /** Mối quan hệ với sản phẩm chính */
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  /** ID sản phẩm thành phần (nguyên liệu) */
  @Column({ name: 'component_product_id' })
  componentProductId!: number;

  /** Mối quan hệ với sản phẩm thành phần */
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'component_product_id' })
  componentProduct!: Product;

  /** Số lượng cần dùng của thành phần này */
  @Column({ name: 'quantity', type: 'decimal', precision: 15, scale: 4 })
  quantity!: number;

  /** ID đơn vị tính cho số lượng thành phần */
  @Column({ name: 'unit_id', nullable: true })
  unitId?: number;

  /** Mối quan hệ với đơn vị tính */
  @ManyToOne(() => Unit)
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
