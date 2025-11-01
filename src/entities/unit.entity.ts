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
 * Entity biểu diễn thông tin đơn vị tính trong hệ thống
 * Ánh xạ với bảng 'units' trong cơ sở dữ liệu
 */
@Entity('units')
export class Unit {
  /** ID duy nhất của đơn vị tính (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên đơn vị tính */
  @Column({ name: 'name' })
  name!: string;

  /** Mã đơn vị tính (ví dụ: kg, l, m, v.v.) */
  @Column({ name: 'code' })
  code!: string;

  /** Mô tả đơn vị tính */
  @Column({ name: 'description', nullable: true })
  description?: string;

  /** Trạng thái đơn vị tính sử dụng enum chung */
  @Column({
    name: 'status',
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Thời gian tạo đơn vị tính */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất đơn vị tính */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm (null nếu chưa bị xóa) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;
}
