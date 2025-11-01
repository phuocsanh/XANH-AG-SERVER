import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

/**
 * Entity biểu diễn mối quan hệ giữa sản phẩm và loại phụ
 * Ánh xạ với bảng 'product_subtype_relations' trong cơ sở dữ liệu
 */
@Entity('product_subtype_relations')
export class ProductSubtypeRelation {
  /** ID duy nhất của mối quan hệ (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của sản phẩm */
  @Column({ name: 'product_id' })
  product_id!: number;

  /** ID của loại phụ sản phẩm */
  @Column({ name: 'subtype_id' })
  subtype_id!: number;

  /** Xác định đây có phải là loại phụ sản phẩm chính không (true: chính, false: phụ) */
  @Column({ name: 'is_primary', default: false })
  is_primary!: boolean;

  /** Trạng thái của mối quan hệ (active: hoạt động, inactive: tạm dừng, archived: lưu trữ) */
  @Column({
    name: 'status',
    type: 'enum',
    enum: ['active', 'inactive', 'archived'],
    default: 'active',
  })
  status!: 'active' | 'inactive' | 'archived';

  /** Thời gian tạo mối quan hệ */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất mối quan hệ */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (soft delete) - null nếu chưa bị xóa */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
