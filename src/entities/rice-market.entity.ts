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
  priceAnalysis!: string;

  @Column({ type: 'text', name: 'supply_demand' })
  supplyDemand!: string;

  @Column({ type: 'text', name: 'export_import_info' })
  exportImportInfo!: string;

  @Column({ type: 'jsonb', name: 'related_news' })
  relatedNews!: any[];

  @Column({ type: 'timestamp', name: 'last_updated' })
  lastUpdated!: Date;

  @Column({ type: 'jsonb', name: 'data_sources' })
  dataSources!: string[];

  @Column({ type: 'jsonb', name: 'data_quality' })
  dataQuality!: {
    reliability: string;
    sourcesUsed: number;
    score: number;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
