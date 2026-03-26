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
import { RiceCrop } from './rice-crop.entity';

/**
 * Entity lưu lịch sử tặng quà cho khách hàng
 * Mỗi lần tặng quà tạo 1 bản ghi mới
 */
@Entity('customer_reward_history')
@Index(['customer_id', 'reward_date'])
@Index(['reward_date'])
@Index(['gift_status'])
export class CustomerRewardHistory {
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

  /** Tên khách hàng (denormalized để dễ query) */
  @Column({
    name: 'customer_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Tên khách hàng tại thời điểm tặng quà'
  })
  customer_name?: string;

  /** Mốc tặng quà (60.000.000) */
  @Column({
    name: 'reward_threshold',
    type: 'decimal',
    precision: 15,
    scale: 2,
    comment: 'Mốc doanh số để nhận quà (mặc định 60 triệu)'
  })
  reward_threshold!: number;

  /** Tổng số tiền tích lũy khi tặng quà */
  @Column({
    name: 'accumulated_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    comment: 'Tổng số tiền tích lũy tại thời điểm tặng quà'
  })
  accumulated_amount!: number;

  /** Lần tặng thứ mấy (nếu tặng nhiều lần cùng lúc) */
  @Column({
    name: 'reward_sequence',
    type: 'int',
    default: 1,
    comment: 'Thứ tự tặng quà (nếu 1 lần chốt sổ tặng nhiều phần quà)'
  })
  reward_sequence!: number;

  /** Danh sách ID các mùa vụ đóng góp vào mốc này */
  @Column({
    name: 'season_ids',
    type: 'jsonb',
    nullable: true,
    comment: 'Danh sách ID các mùa vụ đóng góp: [45, 46, 47]'
  })
  season_ids?: number[];

  /** Danh sách tên các mùa vụ */
  @Column({
    name: 'season_names',
    type: 'jsonb',
    nullable: true,
    comment: 'Danh sách tên mùa vụ: ["Đông xuân 2024", "Hè thu 2025"]'
  })
  season_names?: string[];

  /** Chi tiết đóng góp của từng vụ */
  @Column({
    name: 'contribution_details',
    type: 'jsonb',
    nullable: true,
    comment: 'Chi tiết đóng góp: {"season_45": {"amount": 45000000, "date": "2024-12-01"}}'
  })
  contribution_details?: Record<string, any>;

  /** Ngày tặng quà */
  @Column({
    name: 'reward_date',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Ngày tặng quà cho khách hàng'
  })
  reward_date!: Date;

  /** Mô tả quà tặng */
  @Column({
    name: 'gift_description',
    type: 'text',
    nullable: true,
    comment: 'Mô tả quà tặng: "Bộ quà tặng nông dân", "1 bao phân DAP 50kg"'
  })
  gift_description?: string;

  /** Giá trị quà tặng */
  @Column({
    name: 'gift_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    comment: 'Giá trị quà tặng quy đổi ra tiền'
  })
  gift_value?: number;

  /** Trạng thái quà tặng */
  @Column({
    name: 'gift_status',
    type: 'varchar',
    length: 50,
    default: 'pending',
    comment: 'pending: chờ tặng, delivered: đã tặng, cancelled: đã hủy'
  })
  gift_status!: string;

  @Column({
    name: 'reward_type',
    type: 'varchar',
    length: 50,
    default: 'ACCUMULATION_REWARD',
    comment: 'ACCUMULATION_REWARD: Thưởng tích lũy (70tr), APPRECIATION_GIFT: Quà tri ân'
  })
  reward_type?: string;

  /** ID Ruộng lúa liên quan */
  @Column({ name: 'rice_crop_id', nullable: true })
  rice_crop_id?: number;

  /** Thông tin Ruộng lúa */
  @ManyToOne(() => RiceCrop)
  @JoinColumn({ name: 'rice_crop_id' })
  rice_crop?: RiceCrop;

  /** Tên Ruộng lúa tại thời điểm tặng quà */
  @Column({
    name: 'rice_crop_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Tên ruộng lúa tại thời điểm tặng quà'
  })
  rice_crop_name?: string;

  /** Ngày trao quà thực tế */
  @Column({
    name: 'delivered_date',
    type: 'timestamp',
    nullable: true,
    comment: 'Ngày trao quà thực tế cho khách hàng'
  })
  delivered_date?: Date;

  /** Ghi chú */
  @Column({
    name: 'notes',
    type: 'text',
    nullable: true,
    comment: 'Ghi chú về quà tặng'
  })
  notes?: string;

  /** ID người tạo */
  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  /** Người tạo */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  /** Ngày tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Ngày cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
