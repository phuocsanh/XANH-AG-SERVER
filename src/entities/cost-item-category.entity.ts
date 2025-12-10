import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CostItem } from './cost-item.entity';

/**
 * Entity biểu diễn loại chi phí canh tác
 * Thay thế enum CostCategory cố định
 */
@Entity('cost_item_categories')
export class CostItemCategory {
  /** ID tự động tăng */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã loại chi phí (unique, map với enum cũ) */
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  /** Tên loại chi phí (hiển thị cho người dùng) */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Mô tả chi tiết về loại chi phí */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Trạng thái kích hoạt */
  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  /** Thời gian tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Quan hệ với CostItem */
  @OneToMany(() => CostItem, (item) => item.categoryRelation)
  items?: CostItem[];
}
