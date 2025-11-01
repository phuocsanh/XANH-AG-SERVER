import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FileUpload } from './file-uploads.entity';

/**
 * Entity biểu diễn mối quan hệ tham chiếu giữa file và các thực thể khác
 * Ánh xạ với bảng 'file_references' trong cơ sở dữ liệu
 */
@Entity('file_references')
export class FileReference {
  /** ID duy nhất của tham chiếu file (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của file được tham chiếu */
  @Column({ name: 'file_id' })
  file_id!: number;

  /** Loại thực thể tham chiếu file (ví dụ: 'product', 'user', 'product_type') */
  @Column({ name: 'entity_type' })
  entity_type!: string;

  /** ID của thực thể tham chiếu file */
  @Column({ name: 'entity_id' })
  entity_id!: number;

  /** Trường cụ thể của thực thể chứa file (ví dụ: 'productThumb', 'productPictures', 'userAvatar') */
  @Column({ name: 'field_name', nullable: true })
  field_name?: string;

  /** Vị trí của file trong mảng (nếu trường là mảng) */
  @Column({ name: 'array_index', nullable: true })
  array_index?: number;

  /** ID của người dùng tạo tham chiếu */
  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  /** ID của người dùng xóa tham chiếu */
  @Column({ name: 'deleted_by', nullable: true })
  deleted_by?: number;

  /** Thời gian tạo tham chiếu */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất tham chiếu */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm tham chiếu */
  @Column({ name: 'deleted_at', nullable: true })
  deleted_at?: Date;

  // Relations
  /** Mối quan hệ nhiều-một với file upload */
  @ManyToOne(() => FileUpload, (fileUpload) => fileUpload.id)
  @JoinColumn({ name: 'file_id' })
  fileUpload!: FileUpload;
}
