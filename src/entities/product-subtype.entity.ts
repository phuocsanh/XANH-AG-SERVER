import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('product_subtypes')
export class ProductSubtype {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'subtype_name' })
  subtypeName: string;

  @Column({ name: 'subtype_code', unique: true })
  subtypeCode: string;

  @Column({ name: 'product_type_id' })
  productTypeId: number;

  @Column({ name: 'description', nullable: true })
  description: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
