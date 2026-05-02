import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { PromotionCampaign } from './promotion-campaign.entity';
import { PromotionRewardPool } from './promotion-reward-pool.entity';

@Entity('customer_promotion_spin_logs')
export class CustomerPromotionSpinLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'promotion_id' })
  promotion_id!: number;

  @ManyToOne(() => PromotionCampaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' })
  promotion?: PromotionCampaign;

  @Column({ name: 'customer_id' })
  customer_id!: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  @Column({ name: 'spin_no', type: 'int', default: 1 })
  spin_no!: number;

  @Column({ name: 'result_type' })
  result_type!: string;

  @Column({ name: 'reward_pool_id', nullable: true })
  reward_pool_id?: number;

  @ManyToOne(() => PromotionRewardPool, { nullable: true })
  @JoinColumn({ name: 'reward_pool_id' })
  reward_pool?: PromotionRewardPool;

  @Column({ name: 'reward_name', nullable: true })
  reward_name?: string;

  @Column({ name: 'reward_bucket_month', type: 'int', nullable: true })
  reward_bucket_month?: number | null;

  @Column({
    name: 'reward_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  reward_value!: number;

  @Column({
    name: 'win_probability_applied',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  win_probability_applied!: number;

  @Column({ name: 'customer_win_count_before_spin', type: 'int', default: 0 })
  customer_win_count_before_spin!: number;

  @Column({ name: 'spun_at', type: 'timestamptz' })
  spun_at!: Date;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
