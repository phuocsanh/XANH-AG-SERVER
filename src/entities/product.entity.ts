import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_name' })
  productName: string;

  @Column({ name: 'product_price' })
  productPrice: string;

  @Column({ name: 'product_status', nullable: true })
  productStatus: number;

  @Column({ name: 'product_thumb' })
  productThumb: string;

  @Column({ name: 'product_pictures', type: 'text', array: true, default: [] })
  productPictures: string[];

  @Column({ name: 'product_videos', type: 'text', array: true, default: [] })
  productVideos: string[];

  @Column({ name: 'product_ratings_average', nullable: true })
  productRatingsAverage: string;

  @Column({ name: 'product_description', nullable: true })
  productDescription: string;

  @Column({ name: 'product_slug', nullable: true })
  productSlug: string;

  @Column({ name: 'product_quantity', nullable: true })
  productQuantity: number;

  @Column({ name: 'product_type' })
  productType: number;

  @Column({ name: 'sub_product_type', type: 'integer', array: true, default: [] })
  subProductType: number[];

  @Column({ name: 'discount', nullable: true })
  discount: string;

  @Column({ name: 'product_discounted_price' })
  productDiscountedPrice: string;

  @Column({ name: 'product_selled', nullable: true })
  productSelled: number;

  @Column({ name: 'product_attributes', type: 'jsonb' })
  productAttributes: any;

  @Column({ name: 'is_draft', nullable: true })
  isDraft: boolean;

  @Column({ name: 'is_published', nullable: true })
  isPublished: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'average_cost_price' })
  averageCostPrice: string;

  @Column({ name: 'profit_margin_percent' })
  profitMarginPercent: string;
}