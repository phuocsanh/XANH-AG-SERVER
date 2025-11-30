import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export interface BPHDailyRiskData {
  date: string;
  dayOfWeek: string;
  tempAvg: number;
  humidityAvg: number;
  rainTotal: number;
  windSpeedAvg: number;
  riskScore: number;
  riskLevel: string;
  breakdown: {
    tempScore: number;
    humidityScore: number;
    rainScore: number;
    windScore: number;
  };
}

@Entity('brown_plant_hopper_warnings')
export class BrownPlantHopperWarning {
  @ApiProperty({ description: 'ID cố định = 1', example: 1 })
  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  @ApiProperty({ description: 'Thời điểm tạo cảnh báo' })
  @Column({ type: 'timestamptz' })
  generated_at!: Date;

  @ApiProperty({ description: 'Mức độ nguy cơ', example: 'CAO' })
  @Column({ type: 'text' })
  risk_level!: string;

  @ApiProperty({ description: 'Tin nhắn cảnh báo chi tiết' })
  @Column({ type: 'text' })
  message!: string;

  @ApiProperty({ description: 'Dữ liệu chi tiết từng ngày' })
  @Column({ type: 'jsonb' })
  daily_data!: BPHDailyRiskData[];

  @ApiProperty({ description: 'Thời điểm cập nhật cuối' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
