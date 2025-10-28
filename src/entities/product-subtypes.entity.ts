import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { BaseStatus } from './base-status.enum';

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
  @Column()
  name!: string;

  /** Mã loại phụ sản phẩm (duy nhất) */
  @Column({ unique: true })
  code!: string;

  /** ID loại sản phẩm mà loại phụ sản phẩm này thuộc về */
  @Column()
  productTypeId!: number;

  /** Mô tả loại phụ sản phẩm */
  @Column({ nullable: true })
  description?: string;

  /** Trạng thái của loại phụ sản phẩm sử dụng enum chung */
  @Column({
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

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
