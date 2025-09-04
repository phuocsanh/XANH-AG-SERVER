import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  /** Trạng thái sản phẩm (1: hoạt động, 0: không hoạt động) */
  @Column({ name: 'product_status', nullable: true })
  productStatus?: number;

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

  /** Thuộc tính sản phẩm (dưới dạng JSON) */
  @Column({ name: 'product_attributes', type: 'jsonb' })
  productAttributes!: any;

  /** Trạng thái nháp (true: nháp, false: không phải nháp) */
  @Column({ name: 'is_draft', nullable: true })
  isDraft?: boolean;

  /** Trạng thái đã xuất bản (true: đã xuất bản, false: chưa xuất bản) */
  @Column({ name: 'is_published', nullable: true })
  isPublished?: boolean;

  /** Thời gian tạo sản phẩm */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất sản phẩm */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Giá vốn trung bình của sản phẩm */
  @Column({ name: 'average_cost_price' })
  averageCostPrice!: string;

  /** Phần trăm lợi nhuận */
  @Column({ name: 'profit_margin_percent' })
  profitMarginPercent!: string;
}
