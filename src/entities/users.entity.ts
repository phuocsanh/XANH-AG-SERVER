import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

/**
 * Enum định nghĩa các trạng thái của người dùng
 */
export enum UserStatus {
  ACTIVE = 'active',      // Người dùng đang hoạt động
  INACTIVE = 'inactive',  // Người dùng tạm ngưng
  ARCHIVED = 'archived',  // Người dùng đã lưu trữ
}

/**
 * Entity biểu diễn thông tin người dùng trong hệ thống
 * Ánh xạ với bảng 'users' trong cơ sở dữ liệu
 */
@Entity('users')
export class User {
  /** ID duy nhất của người dùng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn({ name: 'user_id' })
  userId!: number;

  /** Tên tài khoản của người dùng */
  @Column({ name: 'user_account' })
  userAccount!: string;

  /** Mật khẩu đã hash của người dùng */
  @Column({ name: 'user_password' })
  userPassword!: string;

  /** Salt được sử dụng để hash mật khẩu */
  @Column({ name: 'user_salt' })
  userSalt!: string;

  /** Thời gian đăng nhập gần nhất của người dùng */
  @Column({ name: 'user_login_time', nullable: true })
  userLoginTime?: Date;

  /** Thời gian đăng xuất gần nhất của người dùng */
  @Column({ name: 'user_logout_time', nullable: true })
  userLogoutTime?: Date;

  /** IP đăng nhập gần nhất của người dùng */
  @Column({ name: 'user_login_ip', nullable: true })
  userLoginIp?: string;

  /** Trạng thái người dùng sử dụng enum */
  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  /** Thời gian tạo tài khoản người dùng */
  @CreateDateColumn({ name: 'user_created_at' })
  userCreatedAt!: Date;

  /** Thời gian cập nhật gần nhất tài khoản người dùng */
  @UpdateDateColumn({ name: 'user_updated_at' })
  userUpdatedAt!: Date;

  /** Trạng thái bật/tắt xác thực hai yếu tố của người dùng */
  @Column({ name: 'is_two_factor_enabled', nullable: true })
  isTwoFactorEnabled?: boolean;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}