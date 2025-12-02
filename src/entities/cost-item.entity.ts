import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { RiceCrop } from './rice-crop.entity';

/**
 * Enum định nghĩa loại chi phí
 */
export enum CostCategory {
  SEED = 'seed',                 // Giống
  FERTILIZER = 'fertilizer',     // Phân bón
  PESTICIDE = 'pesticide',       // Thuốc BVTV
  LABOR = 'labor',               // Công lao động
  MACHINERY = 'machinery',       // Máy móc
  IRRIGATION = 'irrigation',     // Tưới tiêu
  OTHER = 'other',               // Khác
}

/**
 * Entity biểu diễn chi phí đầu vào của vụ lúa
 * Ánh xạ với bảng 'cost_items' trong cơ sở dữ liệu
 */
@Entity('cost_items')
export class CostItem {
  @ApiProperty({ description: 'ID duy nhất', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ description: 'ID vụ lúa', example: 1 })
  @Column({ name: 'rice_crop_id' })
  rice_crop_id!: number;

  @ManyToOne(() => RiceCrop)
  @JoinColumn({ name: 'rice_crop_id' })
  rice_crop?: RiceCrop;

  @ApiProperty({ 
    description: 'Loại chi phí', 
    enum: CostCategory,
    example: CostCategory.FERTILIZER 
  })
  @Column({
    name: 'category',
    type: 'enum',
    enum: CostCategory,
  })
  category!: CostCategory;

  @ApiProperty({ description: 'Tên khoản chi', example: 'Giống lúa OM 5451' })
  @Column({ name: 'item_name', length: 255 })
  item_name!: string;

  @ApiProperty({ description: 'Số lượng', example: 50, required: false })
  @Column({ name: 'quantity', type: 'decimal', precision: 10, scale: 2, nullable: true })
  quantity?: number;

  @ApiProperty({ description: 'Đơn vị', example: 'kg', required: false })
  @Column({ name: 'unit', length: 50, nullable: true })
  unit?: string;

  @ApiProperty({ description: 'Đơn giá', example: 50000 })
  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2 })
  unit_price!: number;

  @ApiProperty({ description: 'Tổng chi phí', example: 2500000 })
  @Column({ name: 'total_cost', type: 'decimal', precision: 15, scale: 2 })
  total_cost!: number;

  @ApiProperty({ description: 'Ngày mua/chi', required: false })
  @Column({ name: 'purchase_date', type: 'date', nullable: true })
  purchase_date?: Date;

  @ApiProperty({ description: 'ID hóa đơn (nếu mua từ cửa hàng)', required: false })
  @Column({ name: 'invoice_id', nullable: true })
  invoice_id?: number;

  @ApiProperty({ description: 'Ghi chú', required: false })
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @ApiProperty({ description: 'Thời gian tạo' })
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
