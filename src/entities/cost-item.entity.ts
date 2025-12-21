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
 * Entity biểu diễn chi phí đầu vào của vụ lúa
 * Ánh xạ với bảng 'cost_items' trong cơ sở dữ liệu
 */
@Entity('cost_items')
export class CostItem {
  @ApiProperty({ description: 'ID duy nhất', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ description: 'ID mảnh ruộng', example: 1 })
  @Column({ name: 'rice_crop_id' })
  rice_crop_id!: number;

  @ManyToOne(() => RiceCrop)
  @JoinColumn({ name: 'rice_crop_id' })
  rice_crop?: RiceCrop;


  @ApiProperty({ description: 'Tên khoản chi', example: 'Giống lúa OM 5451' })
  @Column({ name: 'item_name', length: 255 })
  item_name!: string;





  @ApiProperty({ description: 'Tổng chi phí', example: 2500000 })
  @Column({ name: 'total_cost', type: 'decimal', precision: 15, scale: 2 })
  total_cost!: number;

  @ApiProperty({ description: 'Ngày chi', required: false })
  @Column({ name: 'expense_date', type: 'date', nullable: true })
  expense_date?: Date;

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
