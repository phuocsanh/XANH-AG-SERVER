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
import { InventoryReturnItem } from './inventory-return-items.entity';
import { Supplier } from './suppliers.entity';
import { InventoryReceipt } from './inventory-receipts.entity';

/**
 * Entity biểu diễn thông tin phiếu xuất trả hàng
 * Ánh xạ với bảng 'inventory_returns' trong cơ sở dữ liệu
 */
@Entity('inventory_returns')
export class InventoryReturn {
  /** ID duy nhất của phiếu xuất trả hàng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã phiếu xuất trả hàng (duy nhất) */
  @Column({ name: 'code', unique: true })
  code!: string;

  /** ID của phiếu nhập kho gốc (tùy chọn) */
  @Column({ name: 'receipt_id', nullable: true })
  receipt_id?: number;

  /** Quan hệ với phiếu nhập kho gốc */
  @ManyToOne(() => InventoryReceipt, { nullable: true })
  @JoinColumn({ name: 'receipt_id' })
  receipt?: InventoryReceipt;

  /** ID của nhà cung cấp */
  @Column({ name: 'supplier_id' })
  supplier_id!: number;

  /** Quan hệ với nhà cung cấp */
  @ManyToOne(() => Supplier, { nullable: false })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  /** Tổng số tiền của phiếu xuất trả hàng */
  @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2 })
  total_amount!: number;

  /** Lý do trả hàng */
  @Column({ name: 'reason', type: 'text' })
  reason!: string;

  /** Trạng thái phiếu xuất trả hàng (draft, approved, cancelled) */
  @Column({ name: 'status', default: 'draft' })
  status!: string;

  /** Ghi chú về phiếu xuất trả hàng */
  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes?: string;

  /** ID của người tạo phiếu xuất trả hàng */
  @Column({ name: 'created_by' })
  created_by!: number;

  /** ID của người cập nhật phiếu xuất trả hàng */
  @Column({ name: 'updated_by', nullable: true })
  updated_by?: number;

  /** Thời gian tạo phiếu xuất trả hàng */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất phiếu xuất trả hàng */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian duyệt phiếu xuất trả hàng */
  @Column({ name: 'approved_at', nullable: true })
  approved_at?: Date;


  /** Thời gian hủy phiếu xuất trả hàng */
  @Column({ name: 'cancelled_at', nullable: true })
  cancelled_at?: Date;

  /** Lý do hủy phiếu xuất trả hàng (có thể null) */
  @Column({ name: 'cancelled_reason', nullable: true, type: 'text' })
  cancelled_reason?: string;

  /** Thời gian xóa phiếu xuất trả hàng (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  /** Quan hệ với các item trong phiếu xuất trả hàng */
  @OneToMany(() => InventoryReturnItem, (item) => item.return)
  items!: InventoryReturnItem[];
}
