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
  @Column({ name: 'symbol_code', unique: true })
  symbolCode!: string;

  /** Tên ký hiệu */
  @Column({ name: 'symbol_name' })
  symbolName!: string;

  /** Mô tả ký hiệu */
  @Column({ name: 'description', nullable: true })
  description?: string;

  /** Thời gian tạo ký hiệu */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất ký hiệu */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Trạng thái của ký hiệu sử dụng enum chung */
  @Column({
    name: 'status',
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Thời gian xóa mềm (null nếu chưa bị xóa) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
