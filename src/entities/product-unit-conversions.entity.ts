import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './products.entity';
import { Unit } from './unit.entity';

/**
 * Entity biểu diễn bảng quy đổi đơn vị tính của sản phẩm.
 * Mỗi sản phẩm có thể có nhiều đơn vị tính (BAO, KG, TẠ...).
 * Một trong số đó là đơn vị cơ sở (is_base_unit = true).
 * Tất cả số lượng tồn kho đều lưu theo đơn vị cơ sở.
 * Ánh xạ với bảng 'product_unit_conversions' trong cơ sở dữ liệu.
 *
 * Ví dụ: Phân NPK 50kg
 *   - KG  | factor=1    | is_base_unit=true
 *   - BAO | factor=50   | is_purchase_unit=true, is_sales_unit=true
 *   - TẠ  | factor=100  | is_sales_unit=true
 */
@Entity('product_unit_conversions')
export class ProductUnitConversion {
  /** ID duy nhất (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID sản phẩm */
  @Column({ name: 'product_id' })
  product_id!: number;

  /** Quan hệ với sản phẩm */
  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  /** ID đơn vị tính */
  @Column({ name: 'unit_id' })
  unit_id!: number;

  /** Quan hệ với đơn vị tính */
  @ManyToOne(() => Unit, { nullable: false })
  @JoinColumn({ name: 'unit_id' })
  unit!: Unit;

  /** Tên đơn vị tính (snapshot để hiển thị nhanh, không cần join) */
  @Column({ name: 'unit_name', length: 50, nullable: true })
  unit_name?: string;

  /**
   * Hệ số quy đổi về đơn vị cơ sở.
   * Ví dụ: 1 BAO = 50 KG thì conversion_factor = 50.
   * Đơn vị cơ sở luôn có factor = 1.
   */
  @Column({
    name: 'conversion_factor',
    type: 'decimal',
    precision: 15,
    scale: 6,
    default: 1,
  })
  conversion_factor!: number;

  /** Đây là đơn vị cơ sở không? (ví dụ: KG, ML...) */
  @Column({ name: 'is_base_unit', type: 'boolean', default: false })
  is_base_unit!: boolean;

  /** Đơn vị này dùng khi NHẬP KHO không? (ví dụ: BAO khi nhập từ nhà cung cấp) */
  @Column({ name: 'is_purchase_unit', type: 'boolean', default: false })
  is_purchase_unit!: boolean;

  /** Đơn vị này dùng khi BÁN HÀNG không? (ví dụ: KG hoặc BAO) */
  @Column({ name: 'is_sales_unit', type: 'boolean', default: false })
  is_sales_unit!: boolean;

  /** Thứ tự hiển thị trong dropdown chọn đơn vị */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order!: number;

  /** Ghi chú (ví dụ: "1 bao = 50kg") */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  /** Thời gian tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
