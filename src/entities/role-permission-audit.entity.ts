import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Nhật ký append-only lưu người thao tác và permission trước/sau mỗi thay đổi. */
@Entity('role_permission_audit')
@Index('idx_role_permission_audit_created_at', ['created_at'])
@Index('idx_role_permission_audit_target_user', ['target_user_id', 'created_at'])
@Index('idx_role_permission_audit_target_role', ['target_role_code', 'created_at'])
export class RolePermissionAudit {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'action', type: 'varchar', length: 40 })
  action!: 'ROLE_PERMISSIONS_UPDATED' | 'USER_PERMISSIONS_UPDATED';

  @Column({ name: 'target_role_code', type: 'varchar', length: 40, nullable: true })
  target_role_code!: string | null;

  @Column({ name: 'target_user_id', type: 'integer', nullable: true })
  target_user_id!: number | null;

  @Column({ name: 'actor_user_id', type: 'integer', nullable: true })
  actor_user_id!: number | null;

  @Column({ name: 'actor_snapshot', type: 'jsonb' })
  actor_snapshot!: { id: number; account: string; name?: string; roleCode?: string };

  @Column({ name: 'target_snapshot', type: 'jsonb' })
  target_snapshot!: { id?: number; account?: string; name?: string; roleCode?: string };

  @Column({ name: 'before_permission_codes', type: 'jsonb' })
  before_permission_codes!: string[];

  @Column({ name: 'after_permission_codes', type: 'jsonb' })
  after_permission_codes!: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;
}
