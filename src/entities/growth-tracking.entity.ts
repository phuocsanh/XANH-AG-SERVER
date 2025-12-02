import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { RiceCrop, GrowthStage } from './rice-crop.entity';

/**
 * Enum tình trạng sức khỏe cây trồng
 */
export enum HealthStatus {
  HEALTHY = 'healthy',     // Khỏe mạnh
  STRESSED = 'stressed',   // Bị stress
  DISEASED = 'diseased',   // Bị bệnh
}

/**
 * Enum mức độ nghiêm trọng
 */
export enum SeverityLevel {
  LOW = 'low',         // Thấp
  MEDIUM = 'medium',   // Trung bình
  HIGH = 'high',       // Cao
  SEVERE = 'severe',   // Nghiêm trọng
}

/**
 * Entity biểu diễn theo dõi sinh trưởng
 * Ánh xạ với bảng 'growth_trackings' trong cơ sở dữ liệu
 */
@Entity('growth_trackings')
export class GrowthTracking {
  @ApiProperty({ description: 'ID duy nhất', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ description: 'ID vụ lúa', example: 1 })
  @Column({ name: 'rice_crop_id' })
  rice_crop_id!: number;

  @ManyToOne(() => RiceCrop)
  @JoinColumn({ name: 'rice_crop_id' })
  rice_crop?: RiceCrop;

  @ApiProperty({ description: 'Ngày quan sát', example: '2024-12-05' })
  @Column({ name: 'tracking_date', type: 'date' })
  tracking_date!: Date;

  @ApiProperty({ 
    description: 'Giai đoạn sinh trưởng', 
    enum: GrowthStage,
    example: GrowthStage.TILLERING 
  })
  @Column({
    name: 'growth_stage',
    type: 'enum',
    enum: GrowthStage,
  })
  growth_stage!: GrowthStage;

  @ApiProperty({ description: 'Chiều cao cây (cm)', required: false })
  @Column({ name: 'plant_height', type: 'decimal', precision: 5, scale: 2, nullable: true })
  plant_height?: number;

  @ApiProperty({ description: 'Số nhánh', required: false })
  @Column({ name: 'tiller_count', type: 'int', nullable: true })
  tiller_count?: number;

  @ApiProperty({ description: 'Màu lá', example: 'xanh đậm', required: false })
  @Column({ name: 'leaf_color', length: 100, nullable: true })
  leaf_color?: string;

  @ApiProperty({ 
    description: 'Tình trạng sức khỏe', 
    enum: HealthStatus,
    example: HealthStatus.HEALTHY 
  })
  @Column({
    name: 'health_status',
    type: 'enum',
    enum: HealthStatus,
  })
  health_status!: HealthStatus;

  @ApiProperty({ description: 'Loại sâu/bệnh phát hiện', required: false })
  @Column({ name: 'pest_disease_detected', length: 255, nullable: true })
  pest_disease_detected?: string;

  @ApiProperty({ 
    description: 'Mức độ nghiêm trọng', 
    enum: SeverityLevel,
    required: false 
  })
  @Column({
    name: 'severity',
    type: 'enum',
    enum: SeverityLevel,
    nullable: true,
  })
  severity?: SeverityLevel;

  @ApiProperty({ description: 'URLs ảnh chụp', type: [String], required: false })
  @Column({ name: 'photo_urls', type: 'jsonb', nullable: true })
  photo_urls?: string[];

  @ApiProperty({ description: 'Ghi chú', required: false })
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @ApiProperty({ description: 'Thời gian tạo' })
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
