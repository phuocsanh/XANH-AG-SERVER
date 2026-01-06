import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './users.entity';

/**
 * Entity biểu diễn thiết bị của user (để gửi push notification)
 * Ánh xạ với bảng 'user_devices' trong cơ sở dữ liệu
 */
@Entity('user_devices')
export class UserDevice {
  /** ID duy nhất của thiết bị (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID của user */
  @Column({ name: 'user_id' })
  user_id!: number;

  /** Quan hệ với user */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** FCM token để gửi push notification */
  @Column({ name: 'fcm_token', type: 'text' })
  fcm_token!: string;

  /** Loại thiết bị: ios, android, web */
  @Column({ 
    name: 'device_type',
    type: 'varchar',
    length: 20,
  })
  device_type!: 'ios' | 'android' | 'web';

  /** Tên thiết bị (optional) */
  @Column({ name: 'device_name', type: 'varchar', length: 255, nullable: true })
  device_name?: string | null;


  /** Thiết bị có đang active không */
  @Column({ name: 'is_active', default: true })
  is_active!: boolean;

  /** Thời gian đăng ký thiết bị */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian sử dụng lần cuối */
  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  last_used_at?: Date;
}
