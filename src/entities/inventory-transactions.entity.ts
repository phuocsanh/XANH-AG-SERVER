import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

/**
 * Entity biểu diễn thông tin giao dịch kho
 * Ánh xạ với bảng 'inventory_transactions' trong cơ sở dữ liệu
 */
@Entity('inventory_transactions')
export class InventoryTransaction {
  /** ID duy nhất của giao dịch kho (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của sản phẩm trong giao dịch */
  @Column({ name: 'product_id' })
  product_id!: number;

  /** Loại giao dịch (ví dụ: 'IN' cho nhập kho, 'OUT' cho xuất kho) */
  @Column({ name: 'type' })
  type!: string;

  /** Số lượng trong giao dịch */
  @Column({ name: 'quantity' })
  quantity!: number;

  /** Giá vốn đơn vị của sản phẩm trong giao dịch */
  @Column({ name: 'unit_cost_price' })
  unit_cost_price!: string;

  /** Tổng giá trị chi phí của giao dịch */
  @Column({ name: 'total_value' })
  total_value!: string;

  /** Số lượng còn lại sau giao dịch */
  @Column({ name: 'remaining_quantity' })
  remaining_quantity!: number;

  /** Giá vốn trung bình mới sau giao dịch */
  @Column({ name: 'new_average_cost' })
  new_average_cost!: string;

  /** ID của item phiếu nhập kho tương ứng (có thể null) */
  @Column({ name: 'receipt_item_id', nullable: true })
  receipt_item_id?: number;

  /** Loại tham chiếu (ví dụ: 'SALE' cho bán hàng, 'ADJUSTMENT' cho điều chỉnh) */
  @Column({ name: 'reference_type', nullable: true })
  reference_type?: string;

  /** ID của tham chiếu (ví dụ: ID hóa đơn bán hàng) */
  @Column({ name: 'reference_id', nullable: true })
  reference_id?: number;

  /** Ghi chú về giao dịch */
  @Column({ name: 'notes', nullable: true })
  notes?: string;

  /** ID của người dùng tạo giao dịch */
  @Column({ name: 'created_by' })
  created_by!: number;

  /** Thời gian tạo giao dịch */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất giao dịch kho */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
