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

@Entity('promotion_reward_pool')
export class PromotionRewardPool {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'promotion_id' })
  promotion_id!: number;

  @ManyToOne(() => PromotionCampaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' })
  promotion?: PromotionCampaign;

  @Column({ name: 'reward_code', nullable: true })
  reward_code?: string;

  @Column({ name: 'reward_name' })
  reward_name!: string;

  @Column({
    name: 'reward_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  reward_value!: number;

  @Column({ name: 'total_quantity', type: 'int', default: 0 })
  total_quantity!: number;

  @Column({ name: 'remaining_quantity', type: 'int', default: 0 })
  remaining_quantity!: number;

  @Column({ name: 'reserved_quantity', type: 'int', default: 0 })
  reserved_quantity!: number;

  @Column({ name: 'issued_quantity', type: 'int', default: 0 })
  issued_quantity!: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order!: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
