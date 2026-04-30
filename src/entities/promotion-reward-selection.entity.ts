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
import { CustomerPromotionProgress } from './customer-promotion-progress.entity';
import { PromotionCampaign } from './promotion-campaign.entity';
import { User } from './users.entity';

@Entity('promotion_reward_selections')
export class PromotionRewardSelection {
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

  @Column({ name: 'progress_id', nullable: true })
  progress_id?: number;

  @ManyToOne(() => CustomerPromotionProgress)
  @JoinColumn({ name: 'progress_id' })
  progress?: CustomerPromotionProgress;

  @Column({ name: 'reward_name' })
  reward_name!: string;

  @Column({
    name: 'reward_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  reward_value!: number;

  @Column({ name: 'selected_by', nullable: true })
  selected_by?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'selected_by' })
  selected_by_user?: User;

  @Column({ name: 'selected_at', type: 'timestamptz', nullable: true })
  selected_at?: Date;

  @Column({ name: 'issue_status', default: 'selected' })
  issue_status!: string;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issued_at?: Date;

  @Column({ name: 'issued_by', nullable: true })
  issued_by?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'issued_by' })
  issued_by_user?: User;

  @Column({ name: 'promotion_expense_status', default: 'pending' })
  promotion_expense_status!: string;

  @Column({
    name: 'promotion_expense_posted_at',
    type: 'timestamptz',
    nullable: true,
  })
  promotion_expense_posted_at?: Date;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
