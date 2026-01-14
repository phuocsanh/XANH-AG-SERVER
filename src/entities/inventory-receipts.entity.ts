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
import { InventoryReceiptPayment } from './inventory-receipt-payments.entity';
import { Supplier } from './suppliers.entity';
import { User } from './users.entity';

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

  /** Trạng thái phiếu nhập kho (draft, approved, cancelled) */
  @Column({ name: 'status', default: 'draft' })
  status!: string;

  /** Ghi chú về phiếu nhập kho */
  @Column({ name: 'notes', nullable: true })
  notes?: string;

  /** Ngày trên hóa đơn / ngày thực tế nhập hàng */
  @Column({ name: 'bill_date', type: 'timestamp', nullable: true })
  bill_date?: Date;

  /** Danh sách URL hình ảnh hóa đơn / chứng từ */
  @Column({ name: 'images', nullable: true, type: 'json' })
  images?: string[];

  /** ID của người tạo phiếu nhập kho */
  @Column({ name: 'created_by' })
  created_by!: number;

  /** Người tạo phiếu */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

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

  /** ID của người duyệt */
  @Column({ name: 'approved_by', nullable: true })
  approved_by?: number;

  /** Người duyệt phiếu */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver?: User;


  /** Thời gian hủy phiếu nhập kho */
  @Column({ name: 'cancelled_at', nullable: true })
  cancelled_at?: Date;

  /** Lý do hủy phiếu nhập kho (có thể null) */
  @Column({ name: 'cancelled_reason', nullable: true })
  cancelled_reason?: string;

  /** Phí vận chuyển chung cho toàn bộ phiếu nhập (tùy chọn) */
  @Column({ name: 'shared_shipping_cost', type: 'decimal', precision: 15, scale: 2, default: 0 })
  shared_shipping_cost?: number;

  /** Phương thức phân bổ phí vận chuyển chung (by_value hoặc by_quantity) */
  @Column({ name: 'shipping_allocation_method', length: 20, default: 'by_value' })
  shipping_allocation_method?: string;

  /** Phí vận chuyển có trả cho nhà cung cấp không? (Mặc định là có, tính vào công nợ) */
  @Column({ name: 'is_shipping_paid_to_supplier', default: true })
  is_shipping_paid_to_supplier!: boolean;

  /** Thời gian xóa phiếu nhập kho (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  // ===== THANH TOÁN =====
  /** Số tiền đã thanh toán */
  @Column({ name: 'paid_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  paid_amount!: number;

  /** Trạng thái thanh toán (unpaid, partial, paid) */
  @Column({ name: 'payment_status', length: 20, default: 'unpaid' })
  payment_status!: string;

  /** Phương thức thanh toán (cash, transfer, debt, mixed) */
  @Column({ name: 'payment_method', length: 50, nullable: true })
  payment_method?: string;

  /** Hạn thanh toán */
  @Column({ name: 'payment_due_date', type: 'timestamp', nullable: true })
  payment_due_date?: Date;

  // ===== ĐIỀU CHỈNH =====
  /** Tổng giá trị đã điều chỉnh (+ hoặc -) */
  @Column({ name: 'adjusted_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  adjusted_amount!: number;

  /** Tổng giá trị đã trả hàng */
  @Column({ name: 'returned_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  returned_amount!: number;

  /** Số tiền cuối cùng (total_amount + adjusted_amount - returned_amount) */
  @Column({ name: 'final_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  final_amount?: number;

  /** Số tiền còn nợ (supplier_amount - paid_amount) */
  @Column({ name: 'debt_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  debt_amount?: number;

  /** Tổng số tiền thực tế nợ nhà cung cấp (đã trừ trả hàng và phí vận chuyển nếu trả ngoài) */
  @Column({ name: 'supplier_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  supplier_amount?: number;

  // ===== CỜ TRẠNG THÁI =====
  /** Có phiếu trả hàng liên quan */
  @Column({ name: 'has_returns', default: false })
  has_returns!: boolean;

  /** Có điều chỉnh */
  @Column({ name: 'has_adjustments', default: false })
  has_adjustments!: boolean;

  /** Khóa không cho sửa payment */
  @Column({ name: 'is_payment_locked', default: false })
  is_payment_locked!: boolean;

  // ===== QUAN HỆ =====
  /** Quan hệ với các item trong phiếu nhập kho */
  @OneToMany(() => InventoryReceiptItem, (item) => item.receipt)
  items!: InventoryReceiptItem[];

  /** Quan hệ với lịch sử thanh toán */
  @OneToMany(() => InventoryReceiptPayment, (payment) => payment.receipt)
  payments!: InventoryReceiptPayment[];
}
