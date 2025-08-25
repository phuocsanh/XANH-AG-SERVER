import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('file_uploads')
export class FileUpload {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id' })
  publicId: string;

  @Column({ name: 'file_url' })
  fileUrl: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_type' })
  fileType: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'folder', nullable: true })
  folder: string;

  @Column({ name: 'mime_type', nullable: true })
  mimeType: string;

  @Column({ name: 'reference_count', nullable: true })
  referenceCount: number;

  @Column({ name: 'is_temporary', nullable: true })
  isTemporary: boolean;

  @Column({ name: 'is_orphaned', nullable: true })
  isOrphaned: boolean;

  @Column({ name: 'uploaded_by_user_id', nullable: true })
  uploadedByUserId: number;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'marked_for_deletion_at', nullable: true })
  markedForDeletionAt: Date;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}