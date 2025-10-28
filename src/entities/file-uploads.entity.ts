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
  @Column()
  publicId!: string;

  /** URL truy cập file */
  @Column()
  url!: string;

  /** Tên file */
  @Column()
  name!: string;

  /** Loại file */
  @Column()
  type!: string;

  /** Kích thước file (bytes) */
  @Column()
  size!: number;

  /** Thư mục chứa file */
  @Column({ nullable: true })
  folder?: string;

  /** Loại MIME của file */
  @Column({ nullable: true })
  mimeType?: string;

  /** Số lượng tham chiếu đến file */
  @Column({ nullable: true })
  referenceCount?: number;

  /** Trạng thái file tạm thời (true: tạm thời, false: không phải tạm thời) */
  @Column({ nullable: true })
  isTemporary?: boolean;

  /** Trạng thái file không được sử dụng (true: không được sử dụng, false: đang được sử dụng) */
  @Column({ nullable: true })
  isOrphaned?: boolean;

  /** ID của người dùng upload file */
  @Column({ nullable: true })
  uploadedBy?: number;

  /** Mảng tag của file */
  @Column('text', { array: true, default: [] })
  tags!: string[];

  /** Metadata của file (dưới dạng JSON) */
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: any;

  /** Thời gian tạo file upload */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất file upload */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Thời gian đánh dấu để xóa file */
  @Column({ name: 'marked_for_deletion_at', nullable: true })
  markedForDeletionAt?: Date;

  /** Thời gian xóa file */
  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
