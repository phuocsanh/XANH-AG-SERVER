import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InventoryReceipt } from './inventory-receipts.entity';
import { User } from './users.entity';

/**
 * Entity biểu diễn thông tin lịch sử chỉnh sửa phiếu nhập kho
 * Dùng để theo dõi ai đã sửa cái gì, lúc nào (Audit Log)
 */
@Entity('inventory_receipt_logs')
export class InventoryReceiptLog {
  /** ID duy nhất của dòng log (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của phiếu nhập kho liên quan */
  @Column({ name: 'receipt_id' })
  receipt_id!: number;

  /** Quan hệ với phiếu nhập kho */
  @ManyToOne(() => InventoryReceipt)
  @JoinColumn({ name: 'receipt_id' })
  receipt?: InventoryReceipt;

  /** Loại hành động (ví dụ: 'UPDATE_METADATA', 'UPDATE_ITEM_PRICE', 'CANCEL_RECEIPT') */
  @Column({ name: 'action' })
  action!: string;

  /** Thông tin chi tiết thay đổi (lưu dưới dạng JSON string) 
   * Ví dụ: { field: 'supplier_id', old: 1, new: 2 }
   */
  @Column({ name: 'details', type: 'text' })
  details!: string;

  /** ID của người dùng thực hiện hành động */
  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  /** Quan hệ với người dùng */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  user?: User;

  /** Thời gian tạo dòng log */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
