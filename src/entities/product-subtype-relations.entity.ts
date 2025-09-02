import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity biểu diễn mối quan hệ giữa sản phẩm và loại phụ sản phẩm
 * Ánh xạ với bảng 'product_subtype_relation' trong cơ sở dữ liệu
 */
@Entity('product_subtype_relations')
export class ProductSubtypeRelation {
  /** ID duy nhất của mối quan hệ (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id: number;

  /** ID của sản phẩm */
  @Column({ name: 'product_id' })
  productId: number;

  /** ID của loại phụ sản phẩm */
  @Column({ name: 'subtype_id' })
  subtypeId: number;

  /** Xác định đây có phải là loại phụ sản phẩm chính không (true: chính, false: phụ) */
  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  /** Thời gian tạo mối quan hệ */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** Thời gian cập nhật gần nhất mối quan hệ */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}