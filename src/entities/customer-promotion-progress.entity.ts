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

@Entity('customer_promotion_progress')
@Index(['promotion_id', 'customer_id'], { unique: true })
export class CustomerPromotionProgress {
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

  @Column({
    name: 'qualified_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  qualified_amount!: number;

  @Column({ name: 'qualified_order_count', type: 'int', default: 0 })
  qualified_order_count!: number;

  @Column({ name: 'earned_spin_count', type: 'int', default: 0 })
  earned_spin_count!: number;

  @Column({ name: 'used_spin_count', type: 'int', default: 0 })
  used_spin_count!: number;

  @Column({ name: 'remaining_spin_count', type: 'int', default: 0 })
  remaining_spin_count!: number;

  @Column({ name: 'win_count', type: 'int', default: 0 })
  win_count!: number;

  @Column({ name: 'last_spin_at', type: 'timestamptz', nullable: true })
  last_spin_at?: Date;

  @Column({ name: 'last_win_at', type: 'timestamptz', nullable: true })
  last_win_at?: Date;

  @Column({ name: 'last_calculated_at', type: 'timestamptz', nullable: true })
  last_calculated_at?: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
