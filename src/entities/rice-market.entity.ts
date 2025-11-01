import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity lưu trữ dữ liệu thị trường gạo
 * Được sử dụng để lưu trữ kết quả từ API rice-market vào database
 */
@Entity('rice_market_data')
export class RiceMarketData {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'text', name: 'price_analysis' })
  price_analysis!: string;

  @Column({ type: 'text', name: 'supply_demand' })
  supply_demand!: string;

  @Column({ type: 'text', name: 'export_import_info' })
  export_import_info!: string;

  @Column({ type: 'jsonb', name: 'related_news' })
  related_news!: any[];

  @Column({ type: 'timestamp', name: 'last_updated' })
  last_updated!: Date;

  @Column({ type: 'jsonb', name: 'data_sources' })
  data_sources!: string[];

  @Column({ type: 'jsonb', name: 'data_quality' })
  data_quality!: {
    reliability: string;
    sourcesUsed: number;
    score: number;
  };

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
