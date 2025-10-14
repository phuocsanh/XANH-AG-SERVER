import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity lưu trữ dữ liệu dự báo thời tiết
 * Được sử dụng để lưu trữ kết quả từ API full-forecast vào database
 */
@Entity('weather_forecasts')
export class WeatherForecast {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'text', name: 'hydrology_info' })
  hydrologyInfo!: string;

  @Column({ type: 'text', name: 'water_level_info' })
  waterLevelInfo!: string;

  @Column({ type: 'text', name: 'storms_and_tropical_depressions_info' })
  stormsAndTropicalDepressionsInfo!: string;

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
