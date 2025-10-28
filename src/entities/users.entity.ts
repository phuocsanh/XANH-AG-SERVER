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
 * Entity biểu diễn thông tin người dùng trong hệ thống
 * Ánh xạ với bảng 'users' trong cơ sở dữ liệu
 */
@Entity('users')
export class User {
  /** ID duy nhất của người dùng (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên tài khoản của người dùng */
  @Column()
  account!: string;

  /** Mật khẩu đã hash của người dùng */
  @Column()
  password!: string;

  /** Salt được sử dụng để hash mật khẩu */
  @Column()
  salt!: string;

  /** Thời gian đăng nhập gần nhất của người dùng */
  @Column({ nullable: true })
  loginTime?: Date;

  /** Thời gian đăng xuất gần nhất của người dùng */
  @Column({ nullable: true })
  logoutTime?: Date;

  /** IP đăng nhập gần nhất của người dùng */
  @Column({ nullable: true })
  loginIp?: string;

  /** Trạng thái người dùng sử dụng enum chung */
  @Column({
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Thời gian tạo tài khoản người dùng */
  @CreateDateColumn()
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất tài khoản người dùng */
  @UpdateDateColumn()
  updatedAt!: Date;

  /** Trạng thái bật/tắt xác thực hai yếu tố của người dùng */
  @Column({ nullable: true })
  isTwoFactorEnabled?: boolean;

  /** Thời gian xóa mềm (soft delete) */
  @DeleteDateColumn()
  deletedAt?: Date;
}
