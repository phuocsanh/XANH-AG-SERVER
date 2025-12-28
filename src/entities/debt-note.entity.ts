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
import { User } from './users.entity';

/**
 * Enum trạng thái phiếu công nợ
 */
export enum DebtNoteStatus {
  ACTIVE = 'active',       // Đang nợ
  PAID = 'paid',          // Đã trả hết
  OVERDUE = 'overdue',    // Quá hạn
  CANCELLED = 'cancelled', // Đã hủy
  SETTLED = 'settled',    // Đã chốt sổ (chuyển sang mùa mới)
  ROLLED_OVER = 'rolled_over', // Đã chuyển nợ sang mùa khác
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

  /** Người tạo phiếu */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  /** ID phiếu nợ mùa trước (được chuyển từ phiếu nào) */
  @Column({ name: 'rolled_over_from_id', nullable: true })
  rolled_over_from_id?: number;

  /** Phiếu nợ mùa trước */
  @ManyToOne(() => DebtNote, { nullable: true })
  @JoinColumn({ name: 'rolled_over_from_id' })
  rolled_over_from?: DebtNote;

  /** ID phiếu nợ mùa sau (chuyển sang phiếu nào) */
  @Column({ name: 'rolled_over_to_id', nullable: true })
  rolled_over_to_id?: number;

  /** Phiếu nợ mùa sau */
  @ManyToOne(() => DebtNote, { nullable: true })
  @JoinColumn({ name: 'rolled_over_to_id' })
  rolled_over_to?: DebtNote;

  /** Mô tả quà tặng khi quyết toán nợ */
  @Column({ 
    name: 'gift_description', 
    type: 'text', 
    nullable: true,
    comment: 'Mô tả quà tặng khi quyết toán nợ: VD "1 bao phân DAP 50kg", "2 chai thuốc trừ sâu"'
  })
  gift_description?: string;

  /** Giá trị quà tặng khi quyết toán nợ */
  @Column({ 
    name: 'gift_value', 
    type: 'decimal', 
    precision: 10, 
    scale: 2, 
    default: 0,
    comment: 'Giá trị quà tặng quy đổi ra tiền, trừ vào lợi nhuận'
  })
  gift_value!: number;

  /** Đã tặng quà khi chốt sổ hay chưa */
  @Column({
    name: 'reward_given',
    type: 'boolean',
    default: false,
    comment: 'Đã tặng quà khi chốt sổ hay chưa'
  })
  reward_given!: boolean;

  /** Số lần tặng quà khi chốt sổ này */
  @Column({
    name: 'reward_count',
    type: 'int',
    default: 0,
    comment: 'Số lần tặng quà khi chốt sổ này (có thể tặng nhiều lần nếu tích lũy đủ)'
  })
  reward_count!: number;

  /** Ngày chốt sổ công nợ */
  @Column({
    name: 'closed_at',
    type: 'timestamp',
    nullable: true,
    comment: 'Ngày chốt sổ công nợ'
  })
  closed_at?: Date;

  /** Ngày tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Ngày cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
