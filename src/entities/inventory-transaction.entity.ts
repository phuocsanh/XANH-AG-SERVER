import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Entity biểu diễn thông tin giao dịch kho
 * Ánh xạ với bảng 'inventory_transactions' trong cơ sở dữ liệu
 */
@Entity('inventory_transactions')
export class InventoryTransaction {
  /** ID duy nhất của giao dịch kho (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id: number;

  /** ID của sản phẩm trong giao dịch */
  @Column({ name: 'product_id' })
  productId: number;

  /** Loại giao dịch (ví dụ: 'IN' cho nhập kho, 'OUT' cho xuất kho) */
  @Column({ name: 'transaction_type' })
  transactionType: string;

  /** Số lượng trong giao dịch */
  @Column()
  quantity: number;

  /** Giá vốn đơn vị của sản phẩm trong giao dịch */
  @Column({ name: 'unit_cost_price' })
  unitCostPrice: string;

  /** Tổng giá trị chi phí của giao dịch */
  @Column({ name: 'total_cost_value' })
  totalCostValue: string;

  /** Số lượng còn lại sau giao dịch */
  @Column({ name: 'remaining_quantity' })
  remainingQuantity: number;

  /** Giá vốn trung bình mới sau giao dịch */
  @Column({ name: 'new_average_cost' })
  newAverageCost: string;

  /** ID của item phiếu nhập kho tương ứng (có thể null) */
  @Column({ name: 'receipt_item_id', nullable: true })
  receiptItemId: number;

  /** Loại tham chiếu (ví dụ: 'SALE' cho bán hàng, 'ADJUSTMENT' cho điều chỉnh) */
  @Column({ name: 'reference_type', nullable: true })
  referenceType: string;

  /** ID của tham chiếu (ví dụ: ID hóa đơn bán hàng) */
  @Column({ name: 'reference_id', nullable: true })
  referenceId: number;

  /** Ghi chú về giao dịch */
  @Column({ name: 'notes', nullable: true })
  notes: string;

  /** ID của người dùng tạo giao dịch */
  @Column({ name: 'created_by_user_id' })
  createdByUserId: number;

  /** Thời gian tạo giao dịch */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** Thời gian cập nhật gần nhất giao dịch */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}