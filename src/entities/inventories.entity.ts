import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

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
  product_id!: number;

  /** Mã lô hàng (có thể null) */
  @Column({ name: 'code', nullable: true })
  code?: string;

  /** Giá vốn đơn vị của sản phẩm trong lô hàng */
  @Column({ name: 'unit_cost_price' })
  unit_cost_price!: string;

  /** Số lượng ban đầu của lô hàng */
  @Column({ name: 'original_quantity' })
  original_quantity!: number;

  /** Số lượng còn lại của lô hàng */
  @Column({ name: 'remaining_quantity' })
  remaining_quantity!: number;

  /** Ngày hết hạn của lô hàng (có thể null) */
  @Column({ name: 'expiry_date', nullable: true })
  expiry_date?: Date;

  /** Ngày sản xuất của lô hàng (có thể null) */
  @Column({ name: 'manufacturing_date', nullable: true })
  manufacturing_date?: Date;

  /** ID nhà cung cấp (có thể null) */
  @Column({ name: 'supplier_id', nullable: true })
  supplier_id?: number;

  /** Ghi chú về lô hàng (có thể null) */
  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes?: string;

  /** ID của item phiếu nhập kho tương ứng (có thể null) */
  @Column({ name: 'receipt_item_id', nullable: true })
  receipt_item_id?: number;

  /** Thời gian tạo lô hàng tồn kho */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất lô hàng tồn kho */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
