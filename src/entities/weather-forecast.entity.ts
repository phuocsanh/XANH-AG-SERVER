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
  hydrology_info!: string;

  @Column({ type: 'text', name: 'water_level_info' })
  water_level_info!: string;

  @Column({ type: 'text', name: 'storms_and_tropical_depressions_info' })
  storms_and_tropical_depressions_info!: string;

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
