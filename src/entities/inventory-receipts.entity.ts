import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity biểu diễn thông tin phiếu nhập kho
 * Ánh xạ với bảng 'inventory_receipts' trong cơ sở dữ liệu
 */
@Entity('inventory_receipts')
export class InventoryReceipt {
  /** ID duy nhất của phiếu nhập kho (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id: number;

  /** Mã phiếu nhập kho (duy nhất) */
  @Column({ name: 'receipt_code', unique: true })
  receiptCode: string;

  /** Tên nhà cung cấp */
  @Column({ name: 'supplier_name', nullable: true })
  supplierName: string;

  /** Thông tin liên hệ nhà cung cấp */
  @Column({ name: 'supplier_contact', nullable: true })
  supplierContact: string;

  /** Tổng số tiền của phiếu nhập kho */
  @Column({ name: 'total_amount' })
  totalAmount: number;

  /** Trạng thái phiếu nhập kho (draft, approved, completed, cancelled) */
  @Column({ name: 'status', default: 'draft' })
  status: string;

  /** Ghi chú về phiếu nhập kho */
  @Column({ name: 'notes', nullable: true })
  notes: string;

  /** ID của người dùng tạo phiếu nhập kho */
  @Column({ name: 'created_by_user_id' })
  createdByUserId: number;

  /** Thời gian tạo phiếu nhập kho */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** Thời gian cập nhật gần nhất phiếu nhập kho */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /** Thời gian duyệt phiếu nhập kho */
  @Column({ name: 'approved_at', nullable: true })
  approvedAt: Date;

  /** Thời gian hoàn thành phiếu nhập kho */
  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  /** Thời gian hủy phiếu nhập kho */
  @Column({ name: 'cancelled_at', nullable: true })
  cancelledAt: Date;

  /** Lý do hủy phiếu nhập kho */
  @Column({ name: 'cancelled_reason', nullable: true })
  cancelledReason: string;
}