import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SalesInvoice } from './sales-invoices.entity';

/**
 * Entity biểu diễn thông tin mùa vụ
 * Ánh xạ với bảng 'seasons' trong cơ sở dữ liệu
 */
@Entity('seasons')
export class Season {
  /** ID duy nhất của mùa vụ (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên mùa vụ (VD: "Đông Xuân 2024", "Hè Thu 2024") */
  @Column({ name: 'name', length: 100 })
  name!: string;

  /** Mã mùa vụ (VD: "DX2024", "HT2024") - duy nhất */
  @Column({ name: 'code', length: 50, unique: true })
  code!: string;

  /** Năm của mùa vụ */
  @Column({ name: 'year', type: 'int' })
  year!: number;

  /** Ngày bắt đầu mùa vụ */
  @Column({ name: 'start_date', type: 'date', nullable: true })
  start_date?: Date;

  /** Ngày kết thúc mùa vụ */
  @Column({ name: 'end_date', type: 'date', nullable: true })
  end_date?: Date;

  /** Mô tả về mùa vụ */
  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  /** Trạng thái hoạt động (true: đang hoạt động, false: đã kết thúc) */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active!: boolean;

  /** Thời gian tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Danh sách hóa đơn thuộc mùa vụ này */
  @OneToMany(() => SalesInvoice, (invoice) => invoice.season)
  invoices?: SalesInvoice[];
}
