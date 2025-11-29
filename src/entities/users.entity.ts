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
import { BaseStatus } from './base-status.enum';
import { Role } from './role.entity';

/**
 * Entity biểu diễn thông tin người dùng trong hệ thống
 * Ánh xạ với bảng 'users' trong cơ sở dữ liệu
 */
@Entity('users')
export class User {
  /** ID duy nhất của người dùng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên tài khoản của người dùng */
  @Column({ name: 'account' })
  account!: string;

  /** Mật khẩu đã hash của người dùng */
  @Column({ name: 'password' })
  password!: string;

  /** Salt được sử dụng để hash mật khẩu */
  @Column({ name: 'salt' })
  salt!: string;

  /** Thời gian đăng nhập gần nhất của người dùng */
  @Column({ name: 'login_time', nullable: true })
  login_time?: Date;

  /** Thời gian đăng xuất gần nhất của người dùng */
  @Column({ name: 'logout_time', nullable: true })
  logout_time?: Date;

  /** IP đăng nhập gần nhất của người dùng */
  @Column({ name: 'login_ip', nullable: true })
  login_ip?: string;

  /** Trạng thái người dùng sử dụng enum chung */
  @Column({
    name: 'status',
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Thời gian tạo tài khoản người dùng */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất tài khoản người dùng */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Trạng thái bật/tắt xác thực hai yếu tố của người dùng */
  @Column({ name: 'is_two_factor_enabled', nullable: true })
  is_two_factor_enabled?: boolean;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  /** ID của role */
  @Column({ name: 'role_id', nullable: true })
  role_id?: number;

  /** Role của user */
  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: 'role_id' })
  role?: Role;
}
