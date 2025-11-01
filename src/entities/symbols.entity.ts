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
 * Entity biểu diễn thông tin mã ký hiệu trong hệ thống
 * Ánh xạ với bảng 'symbols' trong cơ sở dữ liệu
 */
@Entity('symbols')
export class Symbol {
  /** ID duy nhất của ký hiệu (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã ký hiệu */
  @Column({ name: 'code', unique: true })
  code!: string;

  /** Tên ký hiệu */
  @Column({ name: 'name' })
  name!: string;

  /** Mô tả ký hiệu */
  @Column({ name: 'description', nullable: true })
  description?: string;

  /** Trạng thái của ký hiệu sử dụng enum chung */
  @Column({
    name: 'status',
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Thời gian tạo ký hiệu */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất ký hiệu */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (null nếu chưa bị xóa) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
