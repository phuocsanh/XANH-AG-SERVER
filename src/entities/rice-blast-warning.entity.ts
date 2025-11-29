import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Interface cho dữ liệu chi tiết từng ngày
 */
export interface DailyRiskData {
  date: string; // Định dạng: DD/MM/YYYY
  dayOfWeek: string; // Thứ trong tuần
  tempMin: number; // Nhiệt độ thấp nhất (°C)
  tempMax: number; // Nhiệt độ cao nhất (°C)
  tempAvg: number; // Nhiệt độ trung bình (°C)
  humidityAvg: number; // Độ ẩm trung bình (%)
  lwdHours: number; // Số giờ lá ướt
  rainTotal: number; // Tổng lượng mưa (mm)
  rainHours: number; // Số giờ có mưa
  fogHours: number; // Số giờ có sương mù
  cloudCoverAvg: number; // Độ che phủ mây trung bình (%)
  visibilityAvg: number; // Tầm nhìn trung bình (m)
  riskScore: number; // Điểm nguy cơ tổng (0-135)
  riskLevel: string; // Mức độ nguy cơ
  breakdown: {
    tempScore: number; // Điểm nhiệt độ
    lwdScore: number; // Điểm lá ướt
    humidityScore: number; // Điểm độ ẩm
    rainScore: number; // Điểm mưa
    fogScore: number; // Điểm sương mù
  };
}

/**
 * Entity lưu cảnh báo bệnh đạo ôn mới nhất
 * Chỉ cho phép 1 dòng duy nhất với id = 1
 */
@Entity('rice_blast_warnings')
export class RiceBlastWarning {
  @ApiProperty({ description: 'ID cố định = 1', example: 1 })
  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  @ApiProperty({ description: 'Thời điểm tạo cảnh báo' })
  @Column({ type: 'timestamptz' })
  generated_at!: Date;

  @ApiProperty({ 
    description: 'Mức độ nguy cơ', 
    example: 'RẤT CAO',
    enum: ['AN TOÀN', 'THẤP', 'TRUNG BÌNH', 'CAO', 'RẤT CAO', 'ĐANG CHỜ CẬP NHẬT']
  })
  @Column({ type: 'text' })
  risk_level!: string;

  @ApiProperty({ description: 'Xác suất nhiễm bệnh (%)', example: 95 })
  @Column({ type: 'int' })
  probability!: number;

  @ApiProperty({ 
    description: 'Tin nhắn cảnh báo chi tiết', 
    example: 'CẢNH BÁO ĐỎ – Sương mù dày + lá ướt 16 giờ!\nPhun NGAY hôm nay...' 
  })
  @Column({ type: 'text' })
  message!: string;

  @ApiProperty({ 
    description: 'Ngày cao điểm', 
    example: '30/11 – 02/12',
    nullable: true 
  })
  @Column({ type: 'text', nullable: true })
  peak_days!: string | null;

  @ApiProperty({ 
    description: 'Dữ liệu chi tiết từng ngày (JSON)'
  })
  @Column({ type: 'jsonb' })
  daily_data!: DailyRiskData[];

  @ApiProperty({ description: 'Thời điểm cập nhật cuối' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
