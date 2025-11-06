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
  @Column({ name: 'name' })
  name!: string;

  /** Giá sản phẩm */
  @Column({ name: 'price' })
  price!: string;

  /** Giá bán đề xuất - giá bán sau khi trừ tất cả chi phí vẫn đảm bảo phần trăm lợi nhuận mong muốn */
  @Column({ name: 'suggested_price', nullable: true })
  suggested_price?: string;

  /** Trạng thái sản phẩm sử dụng enum chung */
  @Column({
    name: 'status',
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Đường dẫn thumbnail của sản phẩm */
  @Column({ name: 'thumb' })
  thumb!: string;

  /** Mảng đường dẫn hình ảnh của sản phẩm */
  @Column({ name: 'pictures', type: 'text', array: true, default: [] })
  pictures!: string[];

  /** Mảng đường dẫn video của sản phẩm */
  @Column({ name: 'videos', type: 'text', array: true, default: [] })
  videos!: string[];

  /** Điểm đánh giá trung bình của sản phẩm */
  @Column({ name: 'ratings_average', nullable: true })
  ratings_average?: string;

  /** Mô tả sản phẩm */
  @Column({ name: 'description', nullable: true })
  description?: string;

  /** Slug của sản phẩm (dùng cho SEO) */
  @Column({ name: 'slug', nullable: true })
  slug?: string;

  /** Số lượng tồn kho của sản phẩm */
  @Column({ name: 'quantity', nullable: true })
  quantity?: number;

  /** Loại sản phẩm (tham chiếu đến product_types) */
  @Column({ name: 'type' })
  type!: number;

  /** Mảng loại phụ sản phẩm (tham chiếu đến product_subtypes) */
  @Column({
    name: 'sub_product_type',
    type: 'integer',
    array: true,
    default: [],
  })
  sub_product_type!: number[];

  /** Phần trăm giảm giá */
  @Column({ name: 'discount', nullable: true })
  discount?: string;

  /** Giá sau khi giảm giá */
  @Column({ name: 'discounted_price' })
  discounted_price!: string;

  /** Số lượng đã bán */
  @Column({ name: 'selled', nullable: true })
  selled?: number;

  /** Thuộc tính bổ sung của sản phẩm (JSON) */
  @Column({
    name: 'attributes',
    type: 'jsonb',
    nullable: true,
    default: {},
  })
  attributes?: any;

  /** Phần trăm lợi nhuận */
  @Column({ name: 'profit_margin_percent' })
  profit_margin_percent!: string;

  /** Thời gian tạo sản phẩm */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất sản phẩm */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Giá vốn trung bình của sản phẩm */
  @Column({ name: 'average_cost_price' })
  average_cost_price!: string;

  /** Thời gian xóa mềm (null nếu chưa bị xóa) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  /** Đơn vị tính của sản phẩm */
  @Column({ name: 'unit_id', nullable: true })
  unit_id?: number;

  /** Mối quan hệ nhiều-một với đơn vị tính */
  @ManyToOne(() => Unit, { nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  /** Giá nhập mới nhất của sản phẩm */
  @Column({ name: 'latest_purchase_price', nullable: true })
  latest_purchase_price?: number;

  /** Mã ký hiệu của sản phẩm (liên kết với bảng symbols) */
  @Column({ name: 'symbol_id', nullable: true })
  symbol_id?: number;

  /** Mối quan hệ nhiều-một với ký hiệu */
  @ManyToOne(() => Symbol, { nullable: true })
  @JoinColumn({ name: 'symbol_id' })
  symbol?: Symbol;

  /** Thành phần nguyên liệu của sản phẩm (mảng chuỗi) */
  @Column({ name: 'ingredient', type: 'text', array: true, default: [] })
  ingredient!: string[];
}
