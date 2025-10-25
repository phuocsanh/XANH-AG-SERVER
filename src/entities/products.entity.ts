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
import { Unit } from './unit.entity';
import { BaseStatus } from './base-status.enum';
import { Symbol } from './symbols.entity';

/**
 * Entity biểu diễn thông tin sản phẩm trong hệ thống
 * Ánh xạ với bảng 'products' trong cơ sở dữ liệu
 */
@Entity('products')
export class Product {
  /** ID duy nhất của sản phẩm (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên sản phẩm */
  @Column({ name: 'product_name' })
  productName!: string;

  /** Giá sản phẩm */
  @Column({ name: 'product_price' })
  productPrice!: string;

  /** Trạng thái sản phẩm sử dụng enum chung */
  @Column({
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Đường dẫn thumbnail của sản phẩm */
  @Column({ name: 'product_thumb' })
  productThumb!: string;

  /** Mảng đường dẫn hình ảnh của sản phẩm */
  @Column({ name: 'product_pictures', type: 'text', array: true, default: [] })
  productPictures!: string[];

  /** Mảng đường dẫn video của sản phẩm */
  @Column({ name: 'product_videos', type: 'text', array: true, default: [] })
  productVideos!: string[];

  /** Điểm đánh giá trung bình của sản phẩm */
  @Column({ name: 'product_ratings_average', nullable: true })
  productRatingsAverage?: string;

  /** Mô tả sản phẩm */
  @Column({ name: 'product_description', nullable: true })
  productDescription?: string;

  /** Slug của sản phẩm (dùng cho SEO) */
  @Column({ name: 'product_slug', nullable: true })
  productSlug?: string;

  /** Số lượng tồn kho của sản phẩm */
  @Column({ name: 'product_quantity', nullable: true })
  productQuantity?: number;

  /** Loại sản phẩm (tham chiếu đến product_types) */
  @Column({ name: 'product_type' })
  productType!: number;

  /** Mảng loại phụ sản phẩm (tham chiếu đến product_subtypes) */
  @Column({
    name: 'sub_product_type',
    type: 'integer',
    array: true,
    default: [],
  })
  subProductType!: number[];

  /** Phần trăm giảm giá */
  @Column({ name: 'discount', nullable: true })
  discount?: string;

  /** Giá sau khi giảm giá */
  @Column({ name: 'product_discounted_price' })
  productDiscountedPrice!: string;

  /** Số lượng đã bán */
  @Column({ name: 'product_selled', nullable: true })
  productSelled?: number;

  /** Thuộc tính bổ sung của sản phẩm (JSON) */
  @Column({
    name: 'product_attributes',
    type: 'jsonb',
    nullable: true,
    default: {},
  })
  productAttributes?: any;

  /** Phần trăm lợi nhuận */
  @Column({ name: 'profit_margin_percent' })
  profitMarginPercent!: string;

  /** Thời gian tạo sản phẩm */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất sản phẩm */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Giá vốn trung bình của sản phẩm */
  @Column({ name: 'average_cost_price' })
  averageCostPrice!: string;

  /** Thời gian xóa mềm (null nếu chưa bị xóa) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  /** Đơn vị tính của sản phẩm */
  @Column({ name: 'unit_id', nullable: true })
  unitId?: number;

  /** Mối quan hệ nhiều-một với đơn vị tính */
  @ManyToOne(() => Unit, { nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  /** Giá nhập mới nhất của sản phẩm */
  @Column({ name: 'latest_purchase_price', nullable: true })
  latestPurchasePrice?: number;

  /** Mã ký hiệu của sản phẩm (liên kết với bảng symbols) */
  @Column({ name: 'symbol_id', nullable: true })
  symbolId?: number;

  /** Mối quan hệ nhiều-một với ký hiệu */
  @ManyToOne(() => Symbol, { nullable: true })
  @JoinColumn({ name: 'symbol_id' })
  symbol?: Symbol;

  /** Thành phần nguyên liệu của sản phẩm (mảng chuỗi) */
  @Column({ name: 'ingredient', type: 'text', array: true, default: [] })
  ingredient!: string[];
}
