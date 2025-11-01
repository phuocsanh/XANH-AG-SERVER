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
  @Column({ name: 'name' })
  name!: string;

  /** Mã loại phụ sản phẩm (duy nhất) */
  @Column({ name: 'code', unique: true })
  code!: string;

  /** ID loại sản phẩm mà loại phụ sản phẩm này thuộc về */
  @Column({ name: 'product_type_id' })
  product_type_id!: number;

  /** Mô tả loại phụ sản phẩm */
  @Column({ name: 'description', nullable: true })
  description?: string;

  /** Trạng thái của loại phụ sản phẩm sử dụng enum chung */
  @Column({
    name: 'status',
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Thời gian tạo loại phụ sản phẩm */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật loại phụ sản phẩm */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa loại phụ sản phẩm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
