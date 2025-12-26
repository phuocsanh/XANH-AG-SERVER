import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { DeliveryLog } from './delivery-log.entity';
import { SalesInvoiceItem } from './sales-invoice-items.entity';
import { Product } from './products.entity';

/**
 * Entity biểu diễn chi tiết sản phẩm trong phiếu giao hàng
 * Ánh xạ với bảng 'delivery_log_items' trong cơ sở dữ liệu
 * Lưu thông tin sản phẩm nào được giao trong mỗi phiếu giao hàng
 */
@Entity('delivery_log_items')
export class DeliveryLogItem {
  /** ID duy nhất (khóa chính, tự động tăng) */
  @ApiProperty({ description: 'ID duy nhất', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID phiếu giao hàng */
  @ApiProperty({ description: 'ID phiếu giao hàng', example: 1 })
  @Column({ name: 'delivery_log_id' })
  delivery_log_id!: number;

  /** Thông tin phiếu giao hàng */
  @ManyToOne(() => DeliveryLog, (deliveryLog) => deliveryLog.items)
  @JoinColumn({ name: 'delivery_log_id' })
  delivery_log?: DeliveryLog;

  /** ID item trong hóa đơn bán hàng */
  @ApiProperty({ description: 'ID item trong hóa đơn', example: 10, required: false })
  @Column({ name: 'sales_invoice_item_id', nullable: true })
  sales_invoice_item_id?: number;

  /** Thông tin item hóa đơn */
  @ManyToOne(() => SalesInvoiceItem)
  @JoinColumn({ name: 'sales_invoice_item_id' })
  sales_invoice_item?: SalesInvoiceItem;

  /** ID sản phẩm (snapshot) */
  @ApiProperty({ description: 'ID sản phẩm', example: 5 })
  @Column({ name: 'product_id' })
  product_id!: number;

  /** Thông tin sản phẩm */
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  /** Tên sản phẩm (snapshot tại thời điểm giao) */
  @ApiProperty({ description: 'Tên sản phẩm', example: 'Phân NPK 20-20-15' })
  @Column({ name: 'product_name', length: 255 })
  product_name!: string;

  /** Số lượng giao */
  @ApiProperty({ description: 'Số lượng giao', example: 10 })
  @Column({ name: 'quantity_delivered', type: 'decimal', precision: 10, scale: 2 })
  quantity_delivered!: number;

  /** Đơn vị tính */
  @ApiProperty({ description: 'Đơn vị tính', example: 'Bao', required: false })
  @Column({ name: 'unit', length: 50, nullable: true })
  unit?: string;

  /** Ghi chú cho sản phẩm này */
  @ApiProperty({ description: 'Ghi chú', required: false })
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  /** Alias cho quantity_delivered (để dễ sử dụng) */
  get quantity(): number {
    return this.quantity_delivered;
  }

  set quantity(value: number) {
    this.quantity_delivered = value;
  }
}
