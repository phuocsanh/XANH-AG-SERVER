import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from './users.entity';
import { Permission } from './permission.entity';

/**
 * Entity biểu diễn vai trò (role) trong hệ thống
 * Ánh xạ với bảng 'roles' trong cơ sở dữ liệu
 */
@Entity('roles')
export class Role {
  /** ID duy nhất của role */
  @PrimaryGeneratedColumn()
  id!: number;

  /** Tên hiển thị của role (ví dụ: Quản trị viên, Nhân viên) */
  @Column({ name: 'name' })
  name!: string;

  /** Mã code của role (ví dụ: ADMIN, STAFF) - dùng để check trong code */
  @Column({ name: 'code', unique: true })
  code!: string;

  /** Mô tả về role */
  @Column({ name: 'description', nullable: true, type: 'text' })
  description?: string;

  /** Danh sách user thuộc role này */
  @OneToMany(() => User, (user) => user.role)
  users?: User[];

  /** Danh sách quyền hạn của role */
  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({
    name: 'role_permissions', // Tên bảng trung gian
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions?: Permission[];

  /** Thời gian tạo */
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  /** Thời gian cập nhật */
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
