import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

/**
 * Entity biểu diễn thông tin lô hàng tồn kho
 * Ánh xạ với bảng 'inventories' trong cơ sở dữ liệu
 */
@Entity('inventories')
export class InventoryBatch {
  /** ID duy nhất của lô hàng tồn kho (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của sản phẩm trong lô hàng */
  @Column({ name: 'product_id' })
  productId!: number;

  /** Mã lô hàng (có thể null) */
  @Column({ name: 'batch_code', nullable: true })
  batchCode?: string;

  /** Giá vốn đơn vị của sản phẩm trong lô hàng */
  @Column({ name: 'unit_cost_price' })
  unitCostPrice!: string;

  /** Số lượng ban đầu của lô hàng */
  @Column({ name: 'original_quantity' })
  originalQuantity!: number;

  /** Số lượng còn lại của lô hàng */
  @Column({ name: 'remaining_quantity' })
  remainingQuantity!: number;

  /** Ngày hết hạn của lô hàng (có thể null) */
  @Column({ name: 'expiry_date', nullable: true })
  expiryDate?: Date;

  /** Ngày sản xuất của lô hàng (có thể null) */
  @Column({ name: 'manufacturing_date', nullable: true })
  manufacturingDate?: Date;

  /** ID nhà cung cấp (có thể null) */
  @Column({ name: 'supplier_id', nullable: true })
  supplierId?: number;

  /** Ghi chú về lô hàng (có thể null) */
  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes?: string;

  /** ID của item phiếu nhập kho tương ứng (có thể null) */
  @Column({ name: 'receipt_item_id', nullable: true })
  receiptItemId?: number;

  /** Thời gian tạo lô hàng tồn kho */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất lô hàng tồn kho */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}