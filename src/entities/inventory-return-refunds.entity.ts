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
import { InventoryReturn } from './inventory-returns.entity';
import { User } from './users.entity';

/**
 * Entity biểu diễn lịch sử hoàn tiền cho phiếu trả hàng
 * Ánh xạ với bảng 'inventory_return_refunds' trong cơ sở dữ liệu
 */
@Entity('inventory_return_refunds')
export class InventoryReturnRefund {
  /** ID duy nhất của hoàn tiền (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của phiếu trả hàng */
  @Column({ name: 'return_id' })
  return_id!: number;

  /** Quan hệ với phiếu trả hàng */
  @ManyToOne(() => InventoryReturn, (returnDoc) => returnDoc.refunds, { nullable: false })
  @JoinColumn({ name: 'return_id' })
  return!: InventoryReturn;

  /** Ngày hoàn tiền */
  @Column({ name: 'refund_date', type: 'timestamp' })
  refund_date!: Date;

  /** Số tiền hoàn */
  @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  /** Phương thức hoàn tiền (cash, transfer, debt_offset) */
  @Column({ name: 'refund_method', length: 50 })
  refund_method!: string;

  /** Ghi chú về hoàn tiền */
  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes?: string;

  /** ID của người tạo hoàn tiền */
  @Column({ name: 'created_by' })
  created_by!: number;

  /** Người tạo hoàn tiền */
  @ManyToOne(() => User)
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
