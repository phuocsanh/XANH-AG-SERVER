import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity biểu diễn thông tin file upload
 * Ánh xạ với bảng 'file_uploads' trong cơ sở dữ liệu
 */
@Entity('file_uploads')
export class FileUpload {
  /** ID duy nhất của file upload (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID công khai của file (dùng để truy cập file) */
  @Column({ name: 'public_id' })
  public_id!: string;

  /** URL truy cập file */
  @Column({ name: 'url' })
  url!: string;

  /** Tên file */
  @Column({ name: 'name' })
  name!: string;

  /** Loại file */
  @Column({ name: 'type' })
  type!: string;

  /** Kích thước file (bytes) */
  @Column({ name: 'size' })
  size!: number;

  /** Thư mục chứa file */
  @Column({ name: 'folder', nullable: true })
  folder?: string;

  /** Loại MIME của file */
  @Column({ name: 'mime_type', nullable: true })
  mime_type?: string;

  /** Số lượng tham chiếu đến file */
  @Column({ name: 'reference_count', nullable: true })
  reference_count?: number;

  /** Trạng thái file tạm thời (true: tạm thời, false: không phải tạm thời) */
  @Column({ name: 'is_temporary', nullable: true })
  is_temporary?: boolean;

  /** Trạng thái file không được sử dụng (true: không được sử dụng, false: đang được sử dụng) */
  @Column({ name: 'is_orphaned', nullable: true })
  is_orphaned?: boolean;

  /** ID của người dùng upload file */
  @Column({ name: 'uploaded_by', nullable: true })
  uploaded_by?: number;

  /** Mảng tag của file */
  @Column({ name: 'tags', type: 'text', array: true, default: [] })
  tags!: string[];

  /** Metadata của file (dưới dạng JSON) */
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: any;

  /** Thời gian tạo file upload */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất file upload */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian đánh dấu để xóa file */
  @Column({ name: 'marked_for_deletion_at', nullable: true })
  marked_for_deletion_at?: Date;

  /** Thời gian xóa file */
  @Column({ name: 'deleted_at', nullable: true })
  deleted_at?: Date;
}
