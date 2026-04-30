import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PromotionCampaign } from './promotion-campaign.entity';
import { PromotionRewardPool } from './promotion-reward-pool.entity';

@Entity('promotion_reward_release_schedule')
export class PromotionRewardReleaseSchedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'promotion_id' })
  promotion_id!: number;

  @ManyToOne(() => PromotionCampaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' })
  promotion?: PromotionCampaign;

  @Column({ name: 'reward_pool_id' })
  reward_pool_id!: number;

  @ManyToOne(() => PromotionRewardPool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reward_pool_id' })
  reward_pool?: PromotionRewardPool;

  @Column({ name: 'bucket_month', type: 'int' })
  bucket_month!: number;

  @Column({ name: 'release_quantity', type: 'int', default: 0 })
  release_quantity!: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
