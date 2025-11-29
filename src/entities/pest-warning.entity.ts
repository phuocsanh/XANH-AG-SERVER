import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Interface cho dữ liệu nguy cơ sâu hại theo ngày
 */
export interface PestDailyRiskData {
  date: string; // DD/MM
  dayOfWeek: string; // T2, T3, ...
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  humidityAvg: number;
  rainTotal: number;
  sunHours: number; // Số giờ nắng (ước tính từ cloud cover)
  
  // Điểm số nguy cơ
  stemBorerScore: number; // Điểm sâu đục thân (0-100)
  gallMidgeScore: number; // Điểm muỗi hành (0-100)
  
  // Mức độ nguy cơ
  stemBorerLevel: string; // THẤP, TRUNG BÌNH, CAO
  gallMidgeLevel: string; // THẤP, TRUNG BÌNH, CAO
}

/**
 * Entity lưu trữ cảnh báo sâu hại (Sâu đục thân, Muỗi hành...)
 * Chỉ lưu 1 bản ghi duy nhất (id = 1) và cập nhật liên tục
 */
@Entity('pest_warnings')
export class PestWarning {
  @PrimaryColumn()
  id!: number; // Luôn = 1

  @CreateDateColumn({ name: 'generated_at' })
  generated_at!: Date;

  @Column({ name: 'stem_borer_risk', type: 'varchar', length: 50 })
  stem_borer_risk!: string; // Mức độ nguy cơ sâu đục thân chung

  @Column({ name: 'gall_midge_risk', type: 'varchar', length: 50 })
  gall_midge_risk!: string; // Mức độ nguy cơ muỗi hành chung

  @Column({ name: 'message', type: 'text' })
  message!: string;

  @Column({ name: 'daily_data', type: 'jsonb' })
  daily_data!: PestDailyRiskData[];

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
