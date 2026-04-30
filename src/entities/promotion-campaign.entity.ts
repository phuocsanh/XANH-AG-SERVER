import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './users.entity';
import { PromotionCampaignProduct } from './promotion-campaign-product.entity';
import { PromotionRewardPool } from './promotion-reward-pool.entity';
import { PromotionRewardReleaseSchedule } from './promotion-reward-release-schedule.entity';

export enum PromotionCampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ENDED = 'ended',
  ARCHIVED = 'archived',
}

@Entity('promotion_campaigns')
export class PromotionCampaign {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ default: 'accumulated_purchase_gift' })
  type!: string;

  @Column({
    type: 'enum',
    enum: PromotionCampaignStatus,
    default: PromotionCampaignStatus.DRAFT,
  })
  status!: PromotionCampaignStatus;

  @Column({ name: 'start_at', type: 'timestamptz' })
  start_at!: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  end_at!: Date;

  @Column({
    name: 'threshold_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  threshold_amount!: number;

  @Column({
    name: 'base_win_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  base_win_rate!: number;

  @Column({
    name: 'second_win_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 2,
  })
  second_win_rate!: number;

  @Column({ name: 'reward_release_mode', default: 'monthly' })
  reward_release_mode!: string;

  @Column({ name: 'reward_quota', type: 'int', default: 0 })
  reward_quota!: number;

  @Column({ name: 'reward_type', default: 'spin_reward' })
  reward_type!: string;

  @Column({ name: 'reward_name', default: 'Spin rewards' })
  reward_name!: string;

  @Column({
    name: 'reward_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  reward_value!: number;

  @Column({ name: 'max_reward_per_customer', type: 'int', default: 2 })
  max_reward_per_customer!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_by', nullable: true })
  created_by?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @OneToMany(() => PromotionCampaignProduct, (product) => product.campaign, {
    cascade: true,
  })
  products?: PromotionCampaignProduct[];

  @OneToMany(() => PromotionRewardPool, (rewardPool) => rewardPool.promotion, {
    cascade: true,
  })
  reward_pools?: PromotionRewardPool[];

  @OneToMany(
    () => PromotionRewardReleaseSchedule,
    (release) => release.promotion,
    { cascade: true },
  )
  reward_releases?: PromotionRewardReleaseSchedule[];

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
