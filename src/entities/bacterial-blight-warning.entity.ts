import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Interface cho dữ liệu nguy cơ theo ngày của bệnh cháy bìa lá
 */
export interface BacterialBlightDailyRiskData {
  date: string; // DD/MM
  dayOfWeek: string; // T2, T3, ...
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  humidityAvg: number;
  rainTotal: number; // mm
  rainHours: number; // số giờ có mưa
  windSpeedMax: number; // km/h
  windSpeedAvg: number; // km/h
  rain3Days: number; // tổng mưa 3 ngày (nguy cơ ngập)
  riskScore: number; // 0-135
  riskLevel: string; // AN TOÀN, THẤP, TRUNG BÌNH, CAO, RẤT CAO, CỰC KỲ NGUY HIỂM
  breakdown: {
    tempScore: number;
    rainScore: number;
    windScore: number;
    humidityScore: number;
    floodScore: number; // điểm ngập úng
  };
}

/**
 * Entity lưu trữ cảnh báo bệnh cháy bìa lá do vi khuẩn
 * Chỉ lưu 1 bản ghi duy nhất (id = 1) và cập nhật liên tục
 */
@Entity('bacterial_blight_warnings')
export class BacterialBlightWarning {
  @PrimaryColumn()
  id!: number; // Luôn = 1

  @CreateDateColumn({ name: 'generated_at' })
  generated_at!: Date;

  @Column({ name: 'risk_level', type: 'varchar', length: 50 })
  risk_level!: string;

  @Column({ name: 'probability', type: 'int' })
  probability!: number; // 0-100%

  @Column({ name: 'message', type: 'text' })
  message!: string;

  @Column({ name: 'peak_days', type: 'varchar', length: 100, nullable: true })
  peak_days?: string | null;

  @Column({ name: 'daily_data', type: 'jsonb' })
  daily_data!: BacterialBlightDailyRiskData[];

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
