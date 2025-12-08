import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Customer } from './customer.entity';
import { Season } from './season.entity';
import { AreaOfEachPlotOfLand } from './area-of-each-plot-of-land.entity';

/**
 * Enum định nghĩa giai đoạn sinh trưởng của lúa
 */
export enum GrowthStage {
  SEEDLING = 'seedling',           // Giai đoạn mạ
  TILLERING = 'tillering',         // Đẻ nhánh
  PANICLE_INITIATION = 'panicle',  // Làm đòng
  HEADING = 'heading',             // Trổ bông
  RIPENING = 'ripening',           // Chín
  HARVESTED = 'harvested',         // Đã thu hoạch
}

/**
 * Enum định nghĩa trạng thái vụ lúa
 */
export enum CropStatus {
  ACTIVE = 'active',       // Đang canh tác
  HARVESTED = 'harvested', // Đã thu hoạch
  FAILED = 'failed',       // Thất bại (do thiên tai, sâu bệnh...)
}

/**
 * Entity biểu diễn thông tin vụ lúa của nông dân
 * Ánh xạ với bảng 'rice_crops' trong cơ sở dữ liệu
 */
@Entity('rice_crops')
export class RiceCrop {
  /** ID duy nhất của vụ lúa (khóa chính, tự động tăng) */
  @ApiProperty({ description: 'ID duy nhất của vụ lúa', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID khách hàng (nông dân) sở hữu vụ lúa này */
  @ApiProperty({ description: 'ID khách hàng (nông dân)', example: 1 })
  @Column({ name: 'customer_id' })
  customer_id!: number;

  /** Thông tin khách hàng */
  @ManyToOne(() => Customer, (customer) => customer.invoices)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  /** ID mùa vụ */
  @ApiProperty({ description: 'ID mùa vụ', example: 1 })
  @Column({ name: 'season_id' })
  season_id!: number;

  /** Thông tin mùa vụ */
  @ManyToOne(() => Season, (season) => season.invoices)
  @JoinColumn({ name: 'season_id' })
  season?: Season;

  /** Tên ruộng/lô */
  @ApiProperty({ description: 'Tên ruộng/lô', example: 'Ruộng sau nhà' })
  @Column({ name: 'field_name', length: 100 })
  field_name!: string;

  /** Diện tích ruộng (m²) */
  @ApiProperty({ description: 'Diện tích ruộng (m²)', example: 5000 })
  @Column({ name: 'field_area', type: 'decimal', precision: 10, scale: 2 })
  field_area!: number;

  /** Số lượng đất (amount_of_land) thay cho large_labor_days */
  @ApiProperty({ description: 'Số lượng đất', example: 10 })
  @Column({ name: 'amount_of_land', type: 'decimal', precision: 10, scale: 2 })
  amount_of_land!: number;

  /** ID vùng/lô đất */
  @ApiProperty({ description: 'ID vùng/lô đất', example: 1, required: false })
  @Column({ name: 'area_of_each_plot_of_land_id', nullable: true })
  area_of_each_plot_of_land_id?: number;

  /** Thông tin vùng/lô đất */
  @ManyToOne(() => AreaOfEachPlotOfLand, (area) => area.riceCrops)
  @JoinColumn({ name: 'area_of_each_plot_of_land_id' })
  areaOfEachPlotOfLand?: AreaOfEachPlotOfLand;

  /** Vị trí địa lý (tọa độ hoặc mô tả) */
  @ApiProperty({ description: 'Vị trí địa lý', example: 'Xã Tân Hiệp, An Giang', required: false })
  @Column({ name: 'location', type: 'text', nullable: true })
  location?: string;

  /** Giống lúa */
  @ApiProperty({ description: 'Giống lúa', example: 'OM 5451' })
  @Column({ name: 'rice_variety', length: 100 })
  rice_variety!: string;

  /** Nguồn giống */
  @ApiProperty({ description: 'Nguồn giống', example: 'Trung tâm giống An Giang', required: false })
  @Column({ name: 'seed_source', length: 255, nullable: true })
  seed_source?: string;

  /** Ngày gieo mạ */
  @ApiProperty({ description: 'Ngày gieo mạ', example: '2024-11-01', required: false })
  @Column({ name: 'sowing_date', type: 'date', nullable: true })
  sowing_date?: Date;

  /** Ngày cấy */
  @ApiProperty({ description: 'Ngày cấy', example: '2024-11-20', required: false })
  @Column({ name: 'transplanting_date', type: 'date', nullable: true })
  transplanting_date?: Date;

  /** Ngày dự kiến thu hoạch */
  @ApiProperty({ description: 'Ngày dự kiến thu hoạch', example: '2025-02-15', required: false })
  @Column({ name: 'expected_harvest_date', type: 'date', nullable: true })
  expected_harvest_date?: Date;

  /** Ngày thu hoạch thực tế */
  @ApiProperty({ description: 'Ngày thu hoạch thực tế', example: '2025-02-18', required: false })
  @Column({ name: 'actual_harvest_date', type: 'date', nullable: true })
  actual_harvest_date?: Date;

  /** Giai đoạn sinh trưởng hiện tại */
  @ApiProperty({ 
    description: 'Giai đoạn sinh trưởng', 
    enum: GrowthStage,
    example: GrowthStage.TILLERING 
  })
  @Column({
    name: 'growth_stage',
    type: 'enum',
    enum: GrowthStage,
    default: GrowthStage.SEEDLING,
  })
  growth_stage!: GrowthStage;

  /** Trạng thái vụ lúa */
  @ApiProperty({ 
    description: 'Trạng thái vụ lúa', 
    enum: CropStatus,
    example: CropStatus.ACTIVE 
  })
  @Column({
    name: 'status',
    type: 'enum',
    enum: CropStatus,
    default: CropStatus.ACTIVE,
  })
  status!: CropStatus;

  /** Năng suất thu hoạch (kg) */
  @ApiProperty({ description: 'Năng suất thu hoạch (kg)', example: 3000, required: false })
  @Column({ name: 'yield_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  yield_amount?: number;

  /** Chất lượng gạo (A, B, C) */
  @ApiProperty({ description: 'Chất lượng gạo', example: 'A', required: false })
  @Column({ name: 'quality_grade', length: 10, nullable: true })
  quality_grade?: string;

  /** Ghi chú */
  @ApiProperty({ description: 'Ghi chú', required: false })
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  /** Thời gian tạo */
  @ApiProperty({ description: 'Thời gian tạo' })
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @ApiProperty({ description: 'Thời gian cập nhật' })
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
