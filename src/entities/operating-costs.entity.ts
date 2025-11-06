import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  /** Loại chi phí */
  @Column({ type: 'varchar' })
  type!: string;

  /** Mô tả chi phí */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Thời gian tạo bản ghi */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật bản ghi */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
