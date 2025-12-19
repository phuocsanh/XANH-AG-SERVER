import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { InventoryAdjustmentItem } from './inventory-adjustment-items.entity';

/**
 * Entity biểu diễn thông tin phiếu điều chỉnh kho
 * Ánh xạ với bảng 'inventory_adjustments' trong cơ sở dữ liệu
 */
@Entity('inventory_adjustments')
export class InventoryAdjustment {
  /** ID duy nhất của phiếu điều chỉnh kho (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã phiếu điều chỉnh kho (duy nhất) */
  @Column({ name: 'code', unique: true })
  code!: string;

  /** Loại điều chỉnh (IN: tăng tồn kho, OUT: giảm tồn kho) */
  @Column({ name: 'adjustment_type' })
  adjustment_type!: string;

  /** Lý do điều chỉnh */
  @Column({ name: 'reason', type: 'text' })
  reason!: string;

  /** Trạng thái phiếu điều chỉnh kho (draft, approved, cancelled) */
  @Column({ name: 'status', default: 'draft' })
  status!: string;

  /** Ghi chú về phiếu điều chỉnh kho */
  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes?: string;

  /** Danh sách URL hình ảnh chứng từ / hiện trạng */
  @Column({ name: 'images', nullable: true, type: 'json' })
  images?: string[];

  /** ID của người tạo phiếu điều chỉnh kho */
  @Column({ name: 'created_by' })
  created_by!: number;

  /** ID của người cập nhật phiếu điều chỉnh kho */
  @Column({ name: 'updated_by', nullable: true })
  updated_by?: number;

  /** Thời gian tạo phiếu điều chỉnh kho */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất phiếu điều chỉnh kho */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian duyệt phiếu điều chỉnh kho */
  @Column({ name: 'approved_at', nullable: true })
  approved_at?: Date;


  /** Thời gian hủy phiếu điều chỉnh kho */
  @Column({ name: 'cancelled_at', nullable: true })
  cancelled_at?: Date;

  /** Lý do hủy phiếu điều chỉnh kho (có thể null) */
  @Column({ name: 'cancelled_reason', nullable: true, type: 'text' })
  cancelled_reason?: string;

  /** Thời gian xóa phiếu điều chỉnh kho (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  /** Quan hệ với các item trong phiếu điều chỉnh kho */
  @OneToMany(() => InventoryAdjustmentItem, (item) => item.adjustment)
  items!: InventoryAdjustmentItem[];
}
