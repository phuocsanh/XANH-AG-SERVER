import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Season } from './season.entity';
import { RiceCrop } from './rice-crop.entity';
import { OperatingCostCategory } from './operating-cost-category.entity';

/**
 * Entity biểu diễn chi phí vận hành trong cơ sở dữ liệu
 * Bao gồm các thông tin về chi phí như tên, giá trị, loại và mô tả
 */
@Entity('operating_costs')
export class OperatingCost {
  /** ID tự động tăng của chi phí vận hành */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên chi phí */
  @Column({ type: 'varchar' })
  name!: string;

  /** Giá trị chi phí */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  value!: number;

  /** Loại chi phí (deprecated - sẽ được thay thế bởi category_id) */
  @Column({ type: 'varchar', nullable: true })
  type?: string;

  /** ID Loại chi phí (foreign key to operating_cost_categories) */
  @Column({ name: 'category_id', nullable: true })
  category_id?: number;

  /** Quan hệ Loại chi phí */
  @ManyToOne(() => OperatingCostCategory, (category) => category.costs)
  @JoinColumn({ name: 'category_id' })
  category?: OperatingCostCategory;

  /** Mô tả chi phí */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** ID Mùa vụ liên quan (nếu có) */
  @Column({ name: 'season_id', nullable: true })
  season_id?: number;

  /** Quan hệ Mùa vụ */
  @ManyToOne(() => Season)
  @JoinColumn({ name: 'season_id' })
  season?: Season;

  /** ID Vụ lúa (Ruộng) liên quan (nếu có) */
  @Column({ name: 'rice_crop_id', nullable: true })
  rice_crop_id?: number;

  /** Quan hệ Vụ lúa */
  @ManyToOne(() => RiceCrop)
  @JoinColumn({ name: 'rice_crop_id' })
  rice_crop?: RiceCrop;

  /** Ngày phát sinh chi phí thực tế */
  @Column({ name: 'expense_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  expense_date!: Date;

  /** Thời gian tạo bản ghi */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật bản ghi */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
