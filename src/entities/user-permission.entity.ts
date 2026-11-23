import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Column,
  PrimaryColumn,
} from 'typeorm';
import { Permission } from './permission.entity';
import { User } from './users.entity';

/** Bản ghi cấp trực tiếp một permission cho user, kèm thông tin người cấp. */
@Entity('user_permissions')
export class UserPermission {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  user_id!: number;

  @PrimaryColumn({ name: 'permission_id', type: 'integer' })
  permission_id!: number;

  @Column({ name: 'granted_by_user_id', type: 'integer', nullable: true })
  granted_by_user_id!: number | null;

  @ManyToOne(() => User, (user) => user.permission_grants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission?: Permission;

  @CreateDateColumn({ name: 'granted_at', type: 'timestamp' })
  granted_at!: Date;
}
