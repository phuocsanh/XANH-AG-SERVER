import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { InventoryReceipt } from './inventory-receipts.entity';
import { BaseStatus } from './base-status.enum';

/**
 * Entity biểu diễn thông tin nhà cung cấp
 * Ánh xạ với bảng 'suppliers' trong cơ sở dữ liệu
 */
@Entity('suppliers')
export class Supplier {
  /** ID duy nhất của nhà cung cấp (khóa chính, tự động tăng) */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên nhà cung cấp */
  @Column({ name: 'name' })
  name!: string;

  /** Mã nhà cung cấp (duy nhất) */
  @Column({ name: 'code', unique: true })
  code!: string;

  /** Địa chỉ nhà cung cấp */
  @Column({ name: 'address', nullable: true })
  address?: string;

  /** Số điện thoại liên hệ */
  @Column({ name: 'phone', nullable: true })
  phone?: string;

  /** Email liên hệ */
  @Column({ name: 'email', nullable: true })
  email?: string;

  /** Người liên hệ */
  @Column({ name: 'contact_person', nullable: true })
  contact_person?: string;

  /** Trạng thái nhà cung cấp */
  @Column({
    name: 'status',
    type: 'enum',
    enum: BaseStatus,
    default: BaseStatus.ACTIVE,
  })
  status!: BaseStatus;

  /** Ghi chú về nhà cung cấp */
  @Column({ name: 'notes', nullable: true })
  notes?: string;

  /** ID của người tạo */
  @Column({ name: 'created_by' })
  created_by!: number;

  /** ID của người cập nhật cuối cùng */
  @Column({ name: 'updated_by', nullable: true })
  updated_by?: number;

  /** ID của người xóa (soft delete) */
  @Column({ name: 'deleted_by', nullable: true })
  deleted_by?: number;

  /** Thời gian tạo nhà cung cấp */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật gần nhất */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /** Thời gian xóa mềm */
  @DeleteDateColumn({ name: 'deleted_at' })
  deleted_at?: Date;

  /** Quan hệ với các phiếu nhập kho */
  @OneToMany(() => InventoryReceipt, (receipt) => receipt.supplier)
  receipts!: InventoryReceipt[];
}
