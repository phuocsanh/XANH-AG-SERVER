import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { BaseStatus } from './base-status.enum';

/**
 * Entity biểu diễn thông tin chi tiết profile của người dùng
 * Ánh xạ với bảng 'user_profiles' trong cơ sở dữ liệu
 */
@Entity('user_profiles')
export class UserProfile {
  /** ID của người dùng (khóa chính, tham chiếu đến user_id trong bảng users) */
  @PrimaryColumn({ name: 'id' })
  userId!: number;

  /** Tên tài khoản của người dùng */
  @Column()
  account!: string;

  /** Biệt danh của người dùng */
  @Column({ nullable: true })
  nickname?: string;

  /** Đường dẫn avatar của người dùng */
  @Column({ nullable: true })
  avatar?: string;

  /** Trạng thái người dùng sử dụng enum chung */
  @Column({
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Số điện thoại di động của người dùng */
  @Column({ nullable: true })
  mobile?: string;

  /** Giới tính của người dùng (1: nam, 2: nữ, 3: khác) */
  @Column({ nullable: true })
  gender?: number;

  /** Ngày sinh của người dùng */
  @Column({ nullable: true })
  birthday?: Date;

  /** Địa chỉ email của người dùng */
  @Column({ nullable: true })
  email?: string;

  /** Trạng thái xác thực người dùng (0: chưa xác thực, 1: đã xác thực) */
  @Column()
  isAuthentication!: number;

  /** Thời gian tạo profile người dùng */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất profile người dùng */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
