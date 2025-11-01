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
 * Entity biểu diễn thông tin loại sản phẩm
 * Ánh xạ với bảng 'product_types' trong cơ sở dữ liệu
 */
@Entity('product_types')
export class ProductType {
  /** ID duy nhất của loại sản phẩm (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên loại sản phẩm */
  @Column({ name: 'name' })
  name!: string;

  /** Mã loại sản phẩm (duy nhất) */
  @Column({ name: 'code', unique: true })
  code!: string;

  /** Mô tả loại sản phẩm */
  @Column({ name: 'description', nullable: true })
  description?: string;

  /** Trạng thái của loại sản phẩm sử dụng enum chung */
  @Column({
    name: 'status',
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Thời gian tạo loại sản phẩm */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất loại sản phẩm */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
