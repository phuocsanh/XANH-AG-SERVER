import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InventoryReceiptItem } from './inventory-receipt-items.entity';
import { Supplier } from './suppliers.entity';

/**
 * Entity biểu diễn thông tin phiếu nhập kho
 * Ánh xạ với bảng 'inventory_receipts' trong cơ sở dữ liệu
 */
@Entity('inventory_receipts')
export class InventoryReceipt {
  /** ID duy nhất của phiếu nhập kho (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã phiếu nhập kho (duy nhất) */
  @Column({ name: 'code', unique: true })
  code!: string;

  /** ID của nhà cung cấp */
  @Column({ name: 'supplier_id' })
  supplier_id!: number;

  /** Quan hệ với nhà cung cấp */
  @ManyToOne(() => Supplier, { nullable: false })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  /** Tổng số tiền của phiếu nhập kho */
  @Column({ name: 'total_amount' })
  total_amount!: number;

  /** Trạng thái phiếu nhập kho (draft, approved, completed, cancelled) */
  @Column({ name: 'status', default: 'draft' })
  status!: string;

  /** Ghi chú về phiếu nhập kho */
  @Column({ name: 'notes', nullable: true })
  notes?: string;

  /** ID của người tạo phiếu nhập kho */
  @Column({ name: 'created_by' })
  created_by!: number;

  /** ID của người cập nhật phiếu nhập kho */
  @Column({ name: 'updated_by', nullable: true })
  updated_by?: number;

  /** ID của người xóa phiếu nhập kho */
  @Column({ name: 'deleted_by', nullable: true })
  deleted_by?: number;

  /** Thời gian tạo phiếu nhập kho */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất phiếu nhập kho */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian duyệt phiếu nhập kho */
  @Column({ name: 'approved_at', nullable: true })
  approved_at?: Date;

  /** Thời gian hoàn thành phiếu nhập kho */
  @Column({ name: 'completed_at', nullable: true })
  completed_at?: Date;

  /** Thời gian hủy phiếu nhập kho */
  @Column({ name: 'cancelled_at', nullable: true })
  cancelled_at?: Date;

  /** Lý do hủy phiếu nhập kho (có thể null) */
  @Column({ name: 'cancelled_reason', nullable: true })
  cancelled_reason?: string;

  /** Thời gian xóa phiếu nhập kho (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  /** Quan hệ với các item trong phiếu nhập kho */
  @OneToMany(() => InventoryReceiptItem, (item) => item.receipt)
  items!: InventoryReceiptItem[];
}
