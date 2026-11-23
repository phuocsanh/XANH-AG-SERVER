import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Permission } from '../../entities/permission.entity';
import { Role } from '../../entities/role.entity';
import { RolePermissionAudit } from '../../entities/role-permission-audit.entity';
import { User } from '../../entities/users.entity';
import { UserPermission } from '../../entities/user-permission.entity';
import { RoleCode } from '../../common/enums/role-code.enum';
import { AuditQueryDto } from './dto/audit-query.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

const EDITABLE_ROLE_CODES = Object.values(RoleCode).filter(
  (code) => code !== RoleCode.SUPER_ADMIN,
);

/** Xử lý ma trận role, direct grants và lịch sử audit phân quyền. */
@Injectable()
export class RolePermissionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermissionAudit)
    private readonly auditRepository: Repository<RolePermissionAudit>,
  ) {}

  async getCatalog(): Promise<Permission[]> {
    return this.permissionRepository.find({ order: { group: 'ASC', code: 'ASC' } });
  }

  async searchUsers(query: { keyword: string; page: number; limit: number }) {
    const pattern = `%${query.keyword.trim().toLocaleLowerCase()}%`;
    const builder = this.dataSource.getRepository(User)
      .createQueryBuilder('user')
      .leftJoin('user.user_profile', 'profile')
      .leftJoin('user.role', 'role')
      .select([
        'user.id',
        'user.account',
        'user.role_id',
        'profile.nickname',
        'profile.mobile',
        'role.id',
        'role.code',
        'role.name',
      ])
      .where('user.deleted_at IS NULL')
      .andWhere('(role.code IS NULL OR role.code != :superAdmin)', { superAdmin: RoleCode.SUPER_ADMIN })
      .andWhere(`(
        LOWER(user.account) LIKE :pattern
        OR LOWER(profile.nickname) LIKE :pattern
        OR LOWER(profile.mobile) LIKE :pattern
      )`, { pattern });

    const [data, total] = await builder
      .orderBy('user.account', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { data, total, page: query.page, limit: query.limit };
  }

  async getRoles(): Promise<Array<{
    id: number;
    code: string;
    name: string;
    permissionCodes: string[];
    isReadOnly: boolean;
  }>> {
    const [roles, allPermissions] = await Promise.all([
      this.roleRepository.find({
        where: { code: In([...EDITABLE_ROLE_CODES, RoleCode.SUPER_ADMIN]) },
        relations: ['permissions'],
        order: { id: 'ASC' },
      }),
      this.permissionRepository.find({ select: { code: true } }),
    ]);
    const allPermissionCodes = allPermissions.map((permission) => permission.code).sort();
    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      permissionCodes: role.code === RoleCode.SUPER_ADMIN
        ? allPermissionCodes
        : (role.permissions ?? []).map((permission) => permission.code).sort(),
      isReadOnly: role.code === RoleCode.SUPER_ADMIN,
    }));
  }

  async updateRolePermissions(
    roleId: number,
    dto: UpdatePermissionsDto,
    actor: User,
  ): Promise<{ roleCode: string; permissionCodes: string[] }> {
    const permissionCodes = this.normalizeCodes(dto.permissionCodes);
    return this.dataSource.transaction(async (manager) => {
      const roleRepository = manager.getRepository(Role);
      const permissionRepository = manager.getRepository(Permission);
      const auditRepository = manager.getRepository(RolePermissionAudit);
      const role = await roleRepository.findOne({
        where: { id: roleId },
        relations: ['permissions'],
      });
      if (!role) throw new NotFoundException('Không tìm thấy vai trò');
      if (!EDITABLE_ROLE_CODES.includes(role.code as (typeof EDITABLE_ROLE_CODES)[number])) {
        throw new BadRequestException('Vai trò này không được phép chỉnh sửa');
      }

      const beforeCodes = (role.permissions ?? []).map((permission) => permission.code).sort();
      if (this.sameCodes(beforeCodes, permissionCodes)) {
        return { roleCode: role.code, permissionCodes: beforeCodes };
      }

      const permissions = await this.resolvePermissions(permissionRepository, permissionCodes);
      role.permissions = permissions;
      await roleRepository.save(role);
      await auditRepository.save(auditRepository.create({
        action: 'ROLE_PERMISSIONS_UPDATED',
        target_role_code: role.code,
        target_user_id: null,
        actor_user_id: actor.id,
        actor_snapshot: this.userSnapshot(actor),
        target_snapshot: { roleCode: role.code, name: role.name },
        before_permission_codes: beforeCodes,
        after_permission_codes: permissionCodes,
      }));

      return { roleCode: role.code, permissionCodes };
    });
  }

  async getUserPermissions(userId: number) {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      relations: [
        'role',
        'role.permissions',
        'user_profile',
        'permission_grants',
        'permission_grants.permission',
      ],
    });
    if (!user || user.deleted_at) throw new NotFoundException('Không tìm thấy người dùng');

    const inheritedCodes = (user.role?.permissions ?? []).map((permission) => permission.code).sort();
    const directCodes = (user.permission_grants ?? [])
      .map((grant) => grant.permission?.code)
      .filter((code): code is string => Boolean(code))
      .sort();
    return {
      user: this.userSnapshot(user),
      role: user.role ? { id: user.role.id, code: user.role.code, name: user.role.name } : null,
      inheritedPermissionCodes: inheritedCodes,
      directPermissionCodes: directCodes,
      effectivePermissionCodes: [...new Set([...inheritedCodes, ...directCodes])].sort(),
    };
  }

  async updateUserPermissions(
    userId: number,
    dto: UpdatePermissionsDto,
    actor: User,
  ): Promise<{ userId: number; directPermissionCodes: string[] }> {
    const permissionCodes = this.normalizeCodes(dto.permissionCodes);
    return this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const permissionRepository = manager.getRepository(Permission);
      const grantRepository = manager.getRepository(UserPermission);
      const auditRepository = manager.getRepository(RolePermissionAudit);
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['role', 'user_profile', 'role.permissions'],
      });
      if (!user || user.deleted_at) throw new NotFoundException('Không tìm thấy người dùng');
      if (user.role?.code === RoleCode.SUPER_ADMIN) {
        throw new BadRequestException('Không thể cấp quyền riêng cho SUPER_ADMIN');
      }

      const existingGrants = await grantRepository.find({
        where: { user_id: user.id },
        relations: ['permission'],
      });
      const beforeCodes = existingGrants
        .map((grant) => grant.permission?.code)
        .filter((code): code is string => Boolean(code))
        .sort();
      if (this.sameCodes(beforeCodes, permissionCodes)) {
        return { userId: user.id, directPermissionCodes: beforeCodes };
      }

      const desiredPermissions = await this.resolvePermissions(permissionRepository, permissionCodes);
      const desiredIds = new Set(desiredPermissions.map((permission) => permission.id));
      const retainedIds = new Set(existingGrants
        .filter((grant) => desiredIds.has(grant.permission_id))
        .map((grant) => grant.permission_id));
      const removedIds = existingGrants
        .filter((grant) => !desiredIds.has(grant.permission_id))
        .map((grant) => grant.permission_id);
      if (removedIds.length) {
        await grantRepository.delete({ user_id: user.id, permission_id: In(removedIds) });
      }
      const newGrants = desiredPermissions
        .filter((permission) => !retainedIds.has(permission.id))
        .map((permission) => grantRepository.create({
          user_id: user.id,
          permission_id: permission.id,
          granted_by_user_id: actor.id,
        }));
      if (newGrants.length) await grantRepository.save(newGrants);

      await auditRepository.save(auditRepository.create({
        action: 'USER_PERMISSIONS_UPDATED',
        target_role_code: null,
        target_user_id: user.id,
        actor_user_id: actor.id,
        actor_snapshot: this.userSnapshot(actor),
        target_snapshot: this.userSnapshot(user),
        before_permission_codes: beforeCodes,
        after_permission_codes: permissionCodes,
      }));
      return { userId: user.id, directPermissionCodes: permissionCodes };
    });
  }

  async resetUserPermissions(userId: number, actor: User) {
    return this.updateUserPermissions(userId, { permissionCodes: [] }, actor);
  }

  async getAuditHistory(query: AuditQueryDto) {
    const builder = this.auditRepository.createQueryBuilder('audit');
    if (query.targetType === 'role') {
      if (!query.roleCode) throw new BadRequestException('Cần truyền roleCode');
      builder.andWhere('audit.target_role_code = :roleCode', { roleCode: query.roleCode });
    } else if (query.targetType === 'user') {
      if (!query.userId) throw new BadRequestException('Cần truyền userId');
      builder.andWhere('audit.target_user_id = :userId', { userId: query.userId });
    }
    const [data, total] = await builder
      .orderBy('audit.created_at', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { data, total, page: query.page, limit: query.limit };
  }

  private normalizeCodes(codes: string[]): string[] {
    if (!Array.isArray(codes)) throw new BadRequestException('permissionCodes phải là mảng');
    return [...new Set(codes)].sort();
  }

  private async resolvePermissions(
    repository: Repository<Permission>,
    codes: string[],
  ): Promise<Permission[]> {
    if (!codes.length) return [];
    const permissions = await repository.find({ where: { code: In(codes) } });
    if (permissions.length !== codes.length) {
      throw new BadRequestException('Danh sách chứa permission code không hợp lệ');
    }
    return permissions;
  }

  private sameCodes(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((code, index) => code === right[index]);
  }

  private userSnapshot(user: User) {
    return {
      id: user.id,
      account: user.account,
      ...(user.user_profile?.nickname ? { name: user.user_profile.nickname } : {}),
      ...(user.role?.code ? { roleCode: user.role.code } : {}),
    };
  }
}
