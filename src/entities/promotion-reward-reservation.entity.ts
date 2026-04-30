import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { CustomerPromotionSpinLog } from './customer-promotion-spin-log.entity';
import { PromotionCampaign } from './promotion-campaign.entity';
import { PromotionRewardPool } from './promotion-reward-pool.entity';
import { User } from './users.entity';

@Entity('promotion_reward_reservations')
export class PromotionRewardReservation {
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

  @Column({ name: 'spin_log_id' })
  spin_log_id!: number;

  @ManyToOne(() => CustomerPromotionSpinLog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'spin_log_id' })
  spin_log?: CustomerPromotionSpinLog;

  @Column({ name: 'reward_pool_id' })
  reward_pool_id!: number;

  @ManyToOne(() => PromotionRewardPool)
  @JoinColumn({ name: 'reward_pool_id' })
  reward_pool?: PromotionRewardPool;

  @Column({ name: 'reward_name' })
  reward_name!: string;

  @Column({
    name: 'reward_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  reward_value!: number;

  @Column({ default: 'reserved' })
  status!: string;

  @Column({ name: 'reserved_at', type: 'timestamptz' })
  reserved_at!: Date;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issued_at?: Date;

  @Column({ name: 'issued_by', nullable: true })
  issued_by?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'issued_by' })
  issuer?: User;

  @Column({ name: 'expense_posted_at', type: 'timestamptz', nullable: true })
  expense_posted_at?: Date;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
