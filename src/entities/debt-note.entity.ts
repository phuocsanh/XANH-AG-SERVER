import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Season } from './season.entity';

/**
 * Enum trạng thái phiếu công nợ
 */
export enum DebtNoteStatus {
  ACTIVE = 'active',       // Đang nợ
  PAID = 'paid',          // Đã trả hết
  OVERDUE = 'overdue',    // Quá hạn
  CANCELLED = 'cancelled', // Đã hủy
}

/**
 * Entity phiếu công nợ
 * Ánh xạ với bảng 'debt_notes' trong cơ sở dữ liệu
 */
@Entity('debt_notes')
export class DebtNote {
  /** ID duy nhất của phiếu công nợ */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Mã phiếu công nợ (DN001, DN002...) - duy nhất */
  @Column({ name: 'code', unique: true, length: 50 })
  code!: string;

  /** ID khách hàng */
  @Column({ name: 'customer_id' })
  customer_id!: number;

  /** Thông tin khách hàng */
  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  /** ID mùa vụ (nullable - có thể không thuộc mùa vụ cụ thể) */
  @Column({ name: 'season_id', nullable: true })
  season_id?: number;

  /** Thông tin mùa vụ */
  @ManyToOne(() => Season)
  @JoinColumn({ name: 'season_id' })
  season?: Season;

  /** Số tiền nợ ban đầu */
  @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  /** Số tiền đã trả */
  @Column({ name: 'paid_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  paid_amount!: number;

  /** Số tiền còn nợ */
  @Column({ name: 'remaining_amount', type: 'decimal', precision: 15, scale: 2 })
  remaining_amount!: number;

  /** Trạng thái phiếu công nợ */
  @Column({
    name: 'status',
    type: 'enum',
    enum: DebtNoteStatus,
    default: DebtNoteStatus.ACTIVE,
  })
  status!: DebtNoteStatus;

  /** Hạn trả */
  @Column({ name: 'due_date', type: 'date', nullable: true })
  due_date?: Date;

  /** Ghi chú */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  /** Danh sách ID hóa đơn gốc (JSON array) */
  @Column({ name: 'source_invoices', type: 'json', nullable: true })
  source_invoices?: number[];

  /** ID người tạo phiếu */
  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  /** Ngày tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Ngày cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
