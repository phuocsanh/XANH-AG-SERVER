import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity biểu diễn thông tin loại sản phẩm
 * Ánh xạ với bảng 'product_types' trong cơ sở dữ liệu
 */
@Entity('product_types')
export class ProductType {
  /** ID duy nhất của loại sản phẩm (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id: number;

  /** Tên loại sản phẩm */
  @Column({ name: 'type_name' })
  typeName: string;

  /** Mã loại sản phẩm (duy nhất) */
  @Column({ name: 'type_code', unique: true })
  typeCode: string;

  /** Mô tả loại sản phẩm */
  @Column({ name: 'description', nullable: true })
  description: string;

  /** Trạng thái hoạt động (true: hoạt động, false: không hoạt động) */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Thời gian tạo loại sản phẩm */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** Thời gian cập nhật gần nhất loại sản phẩm */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}