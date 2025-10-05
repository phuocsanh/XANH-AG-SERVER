import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

/**
 * Enum định nghĩa các trạng thái của loại phụ sản phẩm
 */
export enum ProductSubtypeStatus {
  ACTIVE = 'active',      // Loại phụ sản phẩm đang hoạt động
  INACTIVE = 'inactive',  // Loại phụ sản phẩm tạm ngưng
  ARCHIVED = 'archived',  // Loại phụ sản phẩm đã lưu trữ
}

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

  /** Trạng thái của loại phụ sản phẩm */
  @Column({
    type: 'enum',
    enum: ProductSubtypeStatus,
    default: ProductSubtypeStatus.ACTIVE,
  })
  status!: ProductSubtypeStatus;

  /** Thời gian tạo loại phụ sản phẩm */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật loại phụ sản phẩm */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Thời gian xóa loại phụ sản phẩm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}