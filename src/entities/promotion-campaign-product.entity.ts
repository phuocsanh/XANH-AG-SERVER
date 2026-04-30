import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './products.entity';
import { PromotionCampaign } from './promotion-campaign.entity';

@Entity('promotion_campaign_products')
export class PromotionCampaignProduct {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'promotion_id' })
  promotion_id!: number;

  @ManyToOne(() => PromotionCampaign, (campaign) => campaign.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'promotion_id' })
  campaign!: PromotionCampaign;

  @Column({ name: 'product_id' })
  product_id!: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'product_name_snapshot', nullable: true })
  product_name_snapshot?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
