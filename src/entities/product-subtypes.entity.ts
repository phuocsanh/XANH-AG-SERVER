import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity biểu diễn thông tin loại phụ sản phẩm
 * Ánh xạ với bảng 'product_subtypes' trong cơ sở dữ liệu
 */
@Entity('product_subtypes')
export class ProductSubtype {
  /** ID duy nhất của loại phụ sản phẩm (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên loại phụ sản phẩm */
  @Column({ name: 'subtype_name' })
  subtypeName!: string;

  /** Mã loại phụ sản phẩm (duy nhất) */
  @Column({ name: 'subtype_code', unique: true })
  subtypeCode!: string;

  /** ID loại sản phẩm mà loại phụ sản phẩm này thuộc về */
  @Column({ name: 'product_type_id' })
  productTypeId!: number;

  /** Mô tả loại phụ sản phẩm */
  @Column({ name: 'description', nullable: true })
  description?: string;

  /** Trạng thái hoạt động (true: hoạt động, false: không hoạt động) */
  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  /** Thời gian tạo loại phụ sản phẩm */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất loại phụ sản phẩm */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}