import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { BaseStatus } from './base-status.enum';

/**
 * Entity biểu diễn thông tin bài viết tin tức trong hệ thống
 */
@Entity('news')
export class News {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tiêu đề bài viết */
  @Column({ name: 'title' })
  title!: string;

  /** Đường dẫn thân thiện SEO */
  @Column({ name: 'slug', unique: true })
  slug!: string;

  /** Danh mục bài viết */
  @Column({ name: 'category', nullable: true })
  category?: string;

  /** Nội dung bài viết (HTML) */
  @Column({ name: 'content', type: 'text' })
  content!: string;

  /** Ảnh đại diện (thumbnail) */
  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnail_url?: string;

  /** Mảng đường dẫn hình ảnh trong bài viết hoặc bộ sưu tập */
  @Column({ name: 'images', type: 'text', array: true, default: [] })
  images!: string[];

  /** Tác giả */
  @Column({ name: 'author', nullable: true })
  author?: string;

  /** Trạng thái hiển thị */
  @Column({
    name: 'status',
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Các từ khóa (tags) */
  @Column({ name: 'tags', type: 'text', array: true, default: [] })
  tags!: string[];

  /** Lượt xem */
  @Column({ name: 'views', type: 'int', default: 0 })
  views!: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
