import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './users.entity';

/** Loại phiếu thu được hoàn tác: phiếu công nợ/hóa đơn, phiếu trả vay hoặc phiếu chưa phân bổ. */
export type PaymentRollbackKind = 'invoice' | 'loan' | 'unallocated';

/**
 * Entity lưu vết hoàn tác phiếu thu.
 * Phiếu thu gốc bị xóa cứng khi hoàn tác nên bảng này là nguồn đối soát duy nhất,
 * không có khóa ngoại tới `payments` để không bị xóa theo.
 */
@Entity('payment_rollback_history')
@Index(['payment_id'], { unique: true })
@Index(['customer_id', 'rolled_back_at'])
@Index(['rolled_back_at'])
export class PaymentRollbackHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID phiếu thu đã bị xóa (duy nhất, chống hoàn tác hai lần). */
  @Column({ name: 'payment_id' })
  payment_id!: number;

  @Column({ name: 'payment_code', length: 50 })
  payment_code!: string;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customer_id?: number | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customer_name?: string | null;

  @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  /** invoice | loan | unallocated */
  @Column({ name: 'payment_kind', type: 'varchar', length: 20, default: 'invoice' })
  payment_kind!: PaymentRollbackKind;

  @Column({ name: 'debt_note_code', type: 'varchar', length: 50, nullable: true })
  debt_note_code?: string | null;

  @Column({ name: 'loan_code', type: 'varchar', length: 50, nullable: true })
  loan_code?: string | null;

  /** Lý do hoàn tác do người dùng nhập, bắt buộc. */
  @Column({ name: 'reason', type: 'text' })
  reason!: string;

  @Column({ name: 'rolled_back_by', type: 'int', nullable: true })
  rolled_back_by?: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'rolled_back_by' })
  rollbacker?: User | null;

  @CreateDateColumn({ name: 'rolled_back_at', type: 'timestamp' })
  rolled_back_at!: Date;

  @Column({ name: 'affected_invoices', type: 'int', default: 0 })
  affected_invoices!: number;

  @Column({ name: 'affected_debt_notes', type: 'int', default: 0 })
  affected_debt_notes!: number;

  /** Ảnh chụp phiếu thu trước khi xóa (số tiền, hình thức, ngày thu, ghi chú...). */
  @Column({ name: 'payment_snapshot', type: 'jsonb' })
  payment_snapshot!: Record<string, any>;

  /** Ảnh chụp từng phân bổ và trạng thái hóa đơn trước/sau. */
  @Column({ name: 'allocations_snapshot', type: 'jsonb' })
  allocations_snapshot!: Record<string, any>[];

  /** Ảnh chụp phiếu công nợ trước/sau (có thể nhiều phiếu nếu dữ liệu lệch). */
  @Column({ name: 'debt_notes_snapshot', type: 'jsonb', nullable: true })
  debt_notes_snapshot?: Record<string, any>[] | null;

  /** Ảnh chụp khoản vay trước/sau, chỉ có ở nhánh phiếu trả vay. */
  @Column({ name: 'loan_snapshot', type: 'jsonb', nullable: true })
  loan_snapshot?: Record<string, any> | null;

  /** Ảnh chụp tích lũy khách hàng trước/sau. */
  @Column({ name: 'accumulation_snapshot', type: 'jsonb', nullable: true })
  accumulation_snapshot?: Record<string, any> | null;
}
