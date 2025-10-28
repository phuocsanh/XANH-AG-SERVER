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
  @Column()
  name!: string;

  /** Mã đơn vị tính (ví dụ: kg, l, m, v.v.) */
  @Column()
  code!: string;

  /** Mô tả đơn vị tính */
  @Column({ nullable: true })
  description?: string;

  /** Trạng thái đơn vị tính sử dụng enum chung */
  @Column({
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Thời gian tạo đơn vị tính */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Thời gian cập nhật gần nhất đơn vị tính */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Thời gian xóa mềm (null nếu chưa bị xóa) */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
