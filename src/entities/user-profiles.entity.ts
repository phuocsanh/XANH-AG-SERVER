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
 * Entity biểu diễn thông tin profile người dùng
 * Ánh xạ với bảng 'user_profiles' trong cơ sở dữ liệu
 */
@Entity('user_profiles')
export class UserProfile {
  /** ID của người dùng (khóa chính, tham chiếu đến user_id trong bảng users) */
  @PrimaryColumn({ name: 'user_id' })
  user_id!: number;

  /** Tên tài khoản của người dùng */
  @Column({ name: 'account' })
  account!: string;

  /** Biệt danh của người dùng */
  @Column({ name: 'nickname', nullable: true })
  nickname?: string;

  /** Đường dẫn avatar của người dùng */
  @Column({ name: 'avatar', nullable: true })
  avatar?: string;

  /** Trạng thái người dùng sử dụng enum chung */
  @Column({
    name: 'status',
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Số điện thoại di động của người dùng */
  @Column({ name: 'mobile', nullable: true })
  mobile?: string;

  /** Giới tính của người dùng (1: nam, 2: nữ, 3: khác) */
  @Column({ name: 'gender', nullable: true })
  gender?: number;

  /** Ngày sinh của người dùng */
  @Column({ name: 'birthday', nullable: true })
  birthday?: Date;

  /** Địa chỉ email của người dùng */
  @Column({ name: 'email', nullable: true })
  email?: string;

  /** Trạng thái xác thực người dùng (0: chưa xác thực, 1: đã xác thực) */
  @Column({ name: 'is_authentication', default: 0 })
  is_authentication!: number;

  /** Thời gian tạo profile người dùng */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất profile người dùng */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
