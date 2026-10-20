import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './customer.entity';
import { User } from './users.entity';

/**
 * Trạng thái của một lần xóa tích lũy hiện tại
 * active: đã xóa và còn khôi phục được
 * restored: đã được khôi phục
 */
export enum CustomerRewardResetStatus {
  ACTIVE = 'active',
  RESTORED = 'restored',
}

/**
 * Entity lưu lịch sử xóa "Tích lũy hiện tại" của khách hàng.
 *
 * Mỗi lần người dùng xóa tích lũy sẽ tạo 1 bản ghi snapshot để:
 * - Đối soát ai xóa, xóa bao nhiêu, lý do gì.
 * - Cho phép khôi phục (cộng bù) lại phần đã xóa.
 *
 * Lưu ý: chỉ xóa `pending_amount` của bảng `customer_reward_tracking`;
 * các trường `total_accumulated`, `reward_count`, `last_reward_date` và
 * lịch sử quà tặng được giữ nguyên.
 */
@Entity('customer_reward_reset_history')
@Index(['customer_id', 'created_at'])
@Index(['status'])
export class CustomerRewardResetHistory {
  /** ID bản ghi lịch sử */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID khách hàng bị xóa tích lũy */
  @Column({ name: 'customer_id' })
  customer_id!: number;

  /** Thông tin khách hàng */
  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  /** Tên khách hàng tại thời điểm xóa (snapshot) */
  @Column({
    name: 'customer_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Tên khách hàng tại thời điểm xóa tích lũy',
  })
  customer_name?: string | null;

  /** Số điện thoại khách hàng tại thời điểm xóa (snapshot) */
  @Column({
    name: 'customer_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
    comment: 'Số điện thoại khách hàng tại thời điểm xóa tích lũy',
  })
  customer_phone?: string | null;

  /** Tích lũy hiện tại trước khi xóa */
  @Column({
    name: 'pending_before',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Tích lũy hiện tại trước khi xóa',
  })
  pending_before!: number;

  /** Số tiền tích lũy đã bị trừ */
  @Column({
    name: 'pending_reset',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Số tiền tích lũy hiện tại đã bị trừ khi xóa',
  })
  pending_reset!: number;

  /** Tổng tích lũy tại thời điểm xóa (chỉ để đối soát, không bị thay đổi) */
  @Column({
    name: 'total_accumulated_snapshot',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Tổng tích lũy của khách tại thời điểm xóa (không thay đổi)',
  })
  total_accumulated_snapshot!: number;

  /** Số lần đã nhận quà tại thời điểm xóa (chỉ để đối soát) */
  @Column({
    name: 'reward_count_snapshot',
    type: 'int',
    default: 0,
    comment: 'Số lần nhận quà của khách tại thời điểm xóa (không thay đổi)',
  })
  reward_count_snapshot!: number;

  /** Lý do xóa tích lũy */
  @Column({
    name: 'reason',
    type: 'text',
    comment: 'Lý do xóa tích lũy do người dùng nhập',
  })
  reason!: string;

  /** Trạng thái: active (có thể khôi phục) hoặc restored (đã khôi phục) */
  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: CustomerRewardResetStatus.ACTIVE,
    comment: 'active: đã xóa, còn khôi phục được; restored: đã khôi phục',
  })
  status!: CustomerRewardResetStatus | string;

  /** Số tiền thực tế đã cộng bù khi khôi phục */
  @Column({
    name: 'restored_pending_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    comment: 'Số tiền tích lũy thực tế đã cộng bù khi khôi phục',
  })
  restored_pending_amount?: number | null;

  /** ID người thực hiện xóa */
  @Column({ name: 'created_by', nullable: true })
  created_by?: number | null;

  /** Tài khoản người thực hiện xóa */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  created_by_user?: User | null;

  /** ID người thực hiện khôi phục */
  @Column({ name: 'restored_by', nullable: true })
  restored_by?: number | null;

  /** Tài khoản người thực hiện khôi phục */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'restored_by' })
  restored_by_user?: User | null;

  /** Thời điểm khôi phục */
  @Column({
    name: 'restored_at',
    type: 'timestamp',
    nullable: true,
    comment: 'Thời điểm khôi phục tích lũy',
  })
  restored_at?: Date | null;

  /** Ngày tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Ngày cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
