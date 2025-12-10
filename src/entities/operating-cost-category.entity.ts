import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OperatingCost } from './operating-costs.entity';

/**
 * Entity biểu diễn loại chi phí vận hành
 * Cho phép quản lý động các loại chi phí thay vì hardcode
 */
@Entity('operating_cost_categories')
export class OperatingCostCategory {
  /** ID tự động tăng */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã loại chi phí (unique, dùng để map với dữ liệu cũ) */
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  /** Tên loại chi phí (hiển thị cho người dùng) */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Mô tả chi tiết về loại chi phí */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Trạng thái kích hoạt (cho phép disable category không dùng nữa) */
  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  /** Thời gian tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Quan hệ với OperatingCost */
  @OneToMany(() => OperatingCost, (cost) => cost.category)
  costs?: OperatingCost[];
}
