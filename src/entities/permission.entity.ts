import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
} from 'typeorm';
import { Role } from './role.entity';

/**
 * Entity biểu diễn quyền hạn (permission) trong hệ thống
 * Mỗi quyền tương ứng với một chức năng cụ thể (Ví dụ: USER_CREATE, RICE_BLAST_VIEW)
 */
@Entity('permissions')
export class Permission {
  /** ID duy nhất của quyền */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên hiển thị của quyền (ví dụ: Xem báo cáo, Duyệt người dùng) */
  @Column({ name: 'name' })
  name!: string;

  /** Mã code của quyền (ví dụ: REPORT_VIEW, USER_APPROVE) - dùng để check trong code */
  @Column({ name: 'code', unique: true })
  code!: string;

  /** Mô tả chi tiết về quyền */
  @Column({ name: 'description', nullable: true, type: 'text' })
  description?: string;

  /** Nhóm chức năng (ví dụ: User Management, Rice Blast) - dùng để gom nhóm trên UI */
  @Column({ name: 'group', nullable: true })
  group?: string;

  /** Danh sách các role có quyền này */
  @ManyToMany(() => Role, (role) => role.permissions)
  roles?: Role[];

  /** Thời gian tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
