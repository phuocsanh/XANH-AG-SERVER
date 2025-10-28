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
  @Column()
  name!: string;

  /** Giá sản phẩm */
  @Column()
  price!: string;

  /** Trạng thái sản phẩm sử dụng enum chung */
  @Column({
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Đường dẫn thumbnail của sản phẩm */
  @Column()
  thumb!: string;

  /** Mảng đường dẫn hình ảnh của sản phẩm */
  @Column({ type: 'text', array: true, default: [] })
  pictures!: string[];

  /** Mảng đường dẫn video của sản phẩm */
  @Column({ type: 'text', array: true, default: [] })
  videos!: string[];

  /** Điểm đánh giá trung bình của sản phẩm */
  @Column({ nullable: true })
  ratingsAverage?: string;

  /** Mô tả sản phẩm */
  @Column({ nullable: true })
  description?: string;

  /** Slug của sản phẩm (dùng cho SEO) */
  @Column({ nullable: true })
  slug?: string;

  /** Số lượng tồn kho của sản phẩm */
  @Column({ nullable: true })
  quantity?: number;

  /** Loại sản phẩm (tham chiếu đến product_types) */
  @Column()
  type!: number;

  /** Mảng loại phụ sản phẩm (tham chiếu đến product_subtypes) */
  @Column({
    name: 'sub_product_type',
    type: 'integer',
    array: true,
    default: [],
  })
  subProductType!: number[];

  /** Phần trăm giảm giá */
  @Column({ nullable: true })
  discount?: string;

  /** Giá sau khi giảm giá */
  @Column()
  discountedPrice!: string;

  /** Số lượng đã bán */
  @Column({ nullable: true })
  selled?: number;

  /** Thuộc tính bổ sung của sản phẩm (JSON) */
  @Column({
    type: 'jsonb',
    nullable: true,
    default: {},
  })
  attributes?: any;

  /** Phần trăm lợi nhuận */
  @Column()
  profitMarginPercent!: string;

  /** Thời gian tạo sản phẩm */
  @CreateDateColumn()
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất sản phẩm */
  @UpdateDateColumn()
  updatedAt!: Date;

  /** Giá vốn trung bình của sản phẩm */
  @Column()
  averageCostPrice!: string;

  /** Thời gian xóa mềm (null nếu chưa bị xóa) */
  @DeleteDateColumn()
  deletedAt?: Date;

  /** Đơn vị tính của sản phẩm */
  @Column({ nullable: true })
  unitId?: number;

  /** Mối quan hệ nhiều-một với đơn vị tính */
  @ManyToOne(() => Unit, { nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  /** Giá nhập mới nhất của sản phẩm */
  @Column({ nullable: true })
  latestPurchasePrice?: number;

  /** Mã ký hiệu của sản phẩm (liên kết với bảng symbols) */
  @Column({ nullable: true })
  symbolId?: number;

  /** Mối quan hệ nhiều-một với ký hiệu */
  @ManyToOne(() => Symbol, { nullable: true })
  @JoinColumn({ name: 'symbol_id' })
  symbol?: Symbol;

  /** Thành phần nguyên liệu của sản phẩm (mảng chuỗi) */
  @Column({ type: 'text', array: true, default: [] })
  ingredient!: string[];
}
