import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Entity biểu diễn thông tin chi tiết profile của người dùng
 * Ánh xạ với bảng 'user_profiles' trong cơ sở dữ liệu
 */
@Entity('user_profiles')
export class UserProfile {
  /** ID của người dùng (khóa chính, tham chiếu đến user_id trong bảng users) */
  @PrimaryColumn({ name: 'user_id' })
  userId!: number;

  /** Tên tài khoản của người dùng */
  @Column({ name: 'user_account' })
  userAccount!: string;

  /** Biệt danh của người dùng */
  @Column({ name: 'user_nickname', nullable: true })
  userNickname?: string;

  /** Đường dẫn avatar của người dùng */
  @Column({ name: 'user_avatar', nullable: true })
  userAvatar?: string;

  /** Trạng thái người dùng (1: hoạt động, 0: không hoạt động) */
  @Column({ name: 'user_state' })
  userState!: number;

  /** Số điện thoại di động của người dùng */
  @Column({ name: 'user_mobile', nullable: true })
  userMobile?: string;

  /** Giới tính của người dùng (1: nam, 2: nữ, 3: khác) */
  @Column({ name: 'user_gender', nullable: true })
  userGender?: number;

  /** Ngày sinh của người dùng */
  @Column({ name: 'user_birthday', nullable: true })
  userBirthday?: Date;

  /** Địa chỉ email của người dùng */
  @Column({ name: 'user_email', nullable: true })
  userEmail?: string;

  /** Trạng thái xác thực người dùng (0: chưa xác thực, 1: đã xác thực) */
  @Column({ name: 'user_is_authentication' })
  userIsAuthentication!: number;

  /** Thời gian tạo profile người dùng */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất profile người dùng */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}