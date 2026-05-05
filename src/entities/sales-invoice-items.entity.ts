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
import { SalesInvoice } from './sales-invoices.entity';
import { Product } from './products.entity';
import { ProductCostingMethod } from './products.entity';

export enum SalesInvoiceItemPriceType {
  CASH = 'cash',
  CREDIT = 'credit',
}

/**
 * Entity biểu diễn thông tin chi tiết hóa đơn bán hàng
 * Ánh xạ với bảng 'sales_invoice_item' trong cơ sở dữ liệu
 */
@Entity('sales_invoice_items')
export class SalesInvoiceItem {
  /** ID duy nhất của chi tiết hóa đơn bán hàng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của hóa đơn bán hàng */
  @Column({ name: 'invoice_id' })
  invoice_id!: number;

  /** ID của sản phẩm */
  @Column({ name: 'product_id' })
  product_id!: number;

  /** Tên sản phẩm tại thời điểm mua (snapshot) */
  @Column({ name: 'product_name', nullable: true })
  product_name?: string;

  /** Đơn vị tính của sản phẩm tại thời điểm mua (snapshot) */
  @Column({ name: 'unit_name', nullable: true })
  unit_name?: string;

  /** Số lượng sản phẩm trong hóa đơn */
  @Column({ name: 'quantity' })
  quantity!: number;

  /** Giá đơn vị của sản phẩm */
  @Column({ name: 'unit_price' })
  unit_price!: number;

  /** Số tiền giảm giá cho sản phẩm */
  @Column({ name: 'discount_amount', default: 0 })
  discount_amount!: number;

  /** Tổng giá tiền của sản phẩm */
  @Column({ name: 'total_price' })
  total_price!: number;

  /** Loại giá bán tại thời điểm bán */
  @Column({
    name: 'price_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  price_type?: SalesInvoiceItemPriceType;

  /** Giá vốn đã chốt tại thời điểm bán, tính theo đơn vị cơ sở */
  @Column({
    name: 'cost_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  cost_price?: number;

  /** Cách tính giá vốn snapshot tại thời điểm bán */
  @Column({
    name: 'costing_method_snapshot',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  costing_method_snapshot?: ProductCostingMethod;

  /** Ghi chú về chi tiết hóa đơn */
  @Column({ name: 'notes', nullable: true })
  notes?: string;

  /** Giá bán khai thuế tại thời điểm bán (snapshot) */
  @Column({ name: 'tax_selling_price', nullable: true })
  tax_selling_price?: string;

  /** Số lượng trong item này được tính vào doanh thu thuế */
  @Column({ name: 'taxable_quantity', type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxable_quantity!: number;

  // ===== QUY ĐỔI ĐƠN VỊ TÍNH =====

  /** ID đơn vị bán hàng (ví dụ: BAO, KG - để in hóa đơn đúng đơn vị) */
  @Column({ name: 'sale_unit_id', nullable: true })
  sale_unit_id?: number;

  /**
   * Hệ số quy đổi về đơn vị cơ sở tại thời điểm bán.
   * Ví dụ: bán 1 BAO (50kg) thì conversion_factor = 50, base_quantity = 50.
   * Mặc định = 1 nếu bán theo đơn vị cơ sở (KG).
   */
  @Column({
    name: 'conversion_factor',
    type: 'decimal',
    precision: 15,
    scale: 6,
    default: 1,
    nullable: true,
  })
  conversion_factor?: number;

  /**
   * Số lượng thực tế xuất kho (đơn vị cơ sở).
   * base_quantity = quantity × conversion_factor.
   * Đây là con số dùng để trừ tồn kho.
   * Ví dụ: bán 2 BAO (50kg/bao) → base_quantity = 100 (kg).
   */
  @Column({
    name: 'base_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  base_quantity?: number;

  /** Tên đơn vị tính đối ứng để hiển thị quy đổi (ví dụ: BAO - khi đơn vị bán là KG) */
  @Column({ name: 'other_unit_name', nullable: true })
  other_unit_name?: string;

  /** Hệ số quy đổi của đơn vị đối ứng tại thời điểm bán */
  @Column({
    name: 'other_unit_factor',
    type: 'decimal',
    precision: 15,
    scale: 6,
    default: 1,
    nullable: true,
  })
  other_unit_factor?: number;

  /** Thời gian tạo chi tiết hóa đơn */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất chi tiết hóa đơn bán hàng */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  // Relations
  /** Mối quan hệ nhiều-một với hóa đơn bán hàng */
  @ManyToOne(() => SalesInvoice, (invoice) => invoice.id)
  @JoinColumn({ name: 'invoice_id' })
  invoice!: SalesInvoice;

  /** Mối quan hệ nhiều-một với sản phẩm */
  @ManyToOne(() => Product, (product) => product.id)
  @JoinColumn({ name: 'product_id' })
  product!: Product;
}
