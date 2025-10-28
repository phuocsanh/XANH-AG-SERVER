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
  @Column({ unique: true })
  code!: string;

  /** ID của nhà cung cấp */
  @Column()
  supplierId!: number;

  /** Quan hệ với nhà cung cấp */
  @ManyToOne(() => Supplier, { nullable: false })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  /** Tổng số tiền của phiếu nhập kho */
  @Column()
  totalAmount!: number;

  /** Trạng thái phiếu nhập kho (draft, approved, completed, cancelled) */
  @Column({ default: 'draft' })
  status!: string;

  /** Ghi chú về phiếu nhập kho */
  @Column({ nullable: true })
  notes?: string;

  /** ID của người tạo phiếu nhập kho */
  @Column()
  createdBy!: number;

  /** ID của người cập nhật phiếu nhập kho */
  @Column({ nullable: true })
  updatedBy?: number;

  /** ID của người xóa phiếu nhập kho */
  @Column({ nullable: true })
  deletedBy?: number;

  /** Thời gian tạo phiếu nhập kho */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất phiếu nhập kho */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Thời gian duyệt phiếu nhập kho */
  @Column({ name: 'approved_at', nullable: true })
  approvedAt?: Date;

  /** Thời gian hoàn thành phiếu nhập kho */
  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  /** Thời gian hủy phiếu nhập kho */
  @Column({ name: 'cancelled_at', nullable: true })
  cancelledAt?: Date;

  /** Lý do hủy phiếu nhập kho (có thể null) */
  @Column({ name: 'cancelled_reason', nullable: true })
  cancelledReason?: string;

  /** Thời gian xóa phiếu nhập kho (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  /** Quan hệ với các item trong phiếu nhập kho */
  @OneToMany(() => InventoryReceiptItem, (item) => item.receipt)
  items!: InventoryReceiptItem[];
}
