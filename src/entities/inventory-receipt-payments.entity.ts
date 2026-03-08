import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { InventoryReceipt } from './inventory-receipts.entity';
import type { User } from './users.entity';

/**
 * Entity biểu diễn lịch sử thanh toán cho phiếu nhập kho
 * Ánh xạ với bảng 'inventory_receipt_payments' trong cơ sở dữ liệu
 */
@Entity('inventory_receipt_payments')
export class InventoryReceiptPayment {
  /** ID duy nhất của thanh toán (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của phiếu nhập kho */
  @Column({ name: 'receipt_id' })
  receipt_id!: number;

  /** Quan hệ với phiếu nhập kho */
  @ManyToOne('InventoryReceipt', (receipt: any) => receipt.payments, { nullable: false })
  @JoinColumn({ name: 'receipt_id' })
  receipt!: InventoryReceipt;

  /** Ngày thanh toán */
  @Column({ name: 'payment_date', type: 'timestamp' })
  payment_date!: Date;

  /** Số tiền thanh toán */
  @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  /** Phương thức thanh toán (cash, transfer) */
  @Column({ name: 'payment_method', length: 50 })
  payment_method!: string;

  /** Ghi chú về thanh toán */
  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes?: string;

  /** ID của người tạo thanh toán */
  @Column({ name: 'created_by' })
  created_by!: number;

  /** Người tạo thanh toán */
  @ManyToOne('User')
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  /** Thời gian tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
