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

/**
 * Entity theo dõi tích lũy doanh số của khách hàng để tặng quà
 * Mỗi khách hàng có 1 bản ghi duy nhất
 */
@Entity('customer_reward_tracking')
@Index(['customer_id'], { unique: true })
export class CustomerRewardTracking {
  /** ID duy nhất */
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID khách hàng */
  @Column({ name: 'customer_id' })
  customer_id!: number;

  /** Thông tin khách hàng */
  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  /** Số tiền đang chờ tích lũy (chưa đủ mốc 60 triệu) */
  @Column({
    name: 'pending_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Số tiền tích lũy hiện tại, chưa đủ mốc tặng quà'
  })
  pending_amount!: number;

  /** Tổng số tiền đã tích lũy (bao gồm cả đã tặng quà) */
  @Column({
    name: 'total_accumulated',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Tổng số tiền đã tích lũy từ trước đến nay'
  })
  total_accumulated!: number;

  /** Số lần đã nhận quà */
  @Column({
    name: 'reward_count',
    type: 'int',
    default: 0,
    comment: 'Số lần khách hàng đã nhận quà'
  })
  reward_count!: number;

  /** Ngày nhận quà gần nhất */
  @Column({
    name: 'last_reward_date',
    type: 'timestamp',
    nullable: true,
    comment: 'Ngày nhận quà lần cuối'
  })
  last_reward_date?: Date;

  /** Trạng thái */
  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'active',
    comment: 'active: đang hoạt động, inactive: tạm ngưng'
  })
  status!: string;

  /** Ngày tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Ngày cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
