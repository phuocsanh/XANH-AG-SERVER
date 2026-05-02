import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { PromotionCampaign } from './promotion-campaign.entity';
import { PromotionRewardPool } from './promotion-reward-pool.entity';
import { User } from './users.entity';

@Entity('customer_promotion_overrides')
@Index(['promotion_id', 'customer_id'], { unique: true })
export class CustomerPromotionOverride {
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

  @Column({ name: 'force_win_remaining_count', type: 'int', default: 0 })
  force_win_remaining_count!: number;

  @Column({ name: 'assigned_reward_pool_id', nullable: true })
  assigned_reward_pool_id?: number | null;

  @ManyToOne(() => PromotionRewardPool, { nullable: true })
  @JoinColumn({ name: 'assigned_reward_pool_id' })
  assigned_reward_pool?: PromotionRewardPool | null;

  @Column({ name: 'assigned_reward_name', type: 'varchar', nullable: true })
  assigned_reward_name?: string | null;

  @Column({ name: 'assigned_reward_bucket_month', type: 'int', nullable: true })
  assigned_reward_bucket_month?: number | null;

  @Column({
    name: 'assigned_reward_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  assigned_reward_value!: number;

  @Column({
    name: 'win_rate_multiplier',
    type: 'decimal',
    precision: 8,
    scale: 4,
    default: 1,
  })
  win_rate_multiplier!: number;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'set_by', nullable: true })
  set_by?: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'set_by' })
  setter?: User | null;

  @Column({ name: 'set_at', type: 'timestamptz', nullable: true })
  set_at?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
