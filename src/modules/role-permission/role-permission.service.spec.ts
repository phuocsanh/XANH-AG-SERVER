import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Permission } from '../../entities/permission.entity';
import { Role } from '../../entities/role.entity';
import { RolePermissionAudit } from '../../entities/role-permission-audit.entity';
import { User } from '../../entities/users.entity';
import { UserPermission } from '../../entities/user-permission.entity';
import { RoleCode } from '../../common/enums/role-code.enum';
import { RolePermissionService } from './role-permission.service';

/** Tạo service với repository giả để kiểm tra transaction và audit RBAC. */
function createFixture() {
  const roleRepository = {
    findOne: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const permissionRepository = { find: jest.fn() };
  const userRepository = { findOne: jest.fn() };
  const grantRepository = {
    find: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((value) => value),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const auditRepository = {
    create: jest.fn((value) => value),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const repositories = new Map<unknown, unknown>([
    [Role, roleRepository],
    [Permission, permissionRepository],
    [User, userRepository],
    [UserPermission, grantRepository],
    [RolePermissionAudit, auditRepository],
  ]);
  const manager = {
    getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn(
      (callback: (transactionManager: EntityManager) => Promise<unknown>) =>
        callback(manager),
    ),
  } as unknown as DataSource;
  const service = new RolePermissionService(
    dataSource,
    roleRepository as unknown as Repository<Role>,
    permissionRepository as unknown as Repository<Permission>,
    auditRepository as unknown as Repository<RolePermissionAudit>,
  );

  return {
    service,
    roleRepository,
    permissionRepository,
    userRepository,
    grantRepository,
    auditRepository,
  };
}

describe('RolePermissionService', () => {
  it('lưu quyền role cùng audit trước/sau trong một transaction', async () => {
    const fixture = createFixture();
    const role = Object.assign(new Role(), {
      id: 2,
      code: RoleCode.ADMIN,
      name: 'Admin',
      permissions: [{ id: 1, code: 'sales:read' } as Permission],
    });
    const permission = Object.assign(new Permission(), {
      id: 2,
      code: 'sales:manage',
    });
    const actor = Object.assign(new User(), {
      id: 9,
      account: 'super-admin',
      role: { code: RoleCode.SUPER_ADMIN },
    });
    fixture.roleRepository.findOne.mockResolvedValue(role);
    fixture.permissionRepository.find.mockResolvedValue([permission]);

    const result = await fixture.service.updateRolePermissions(
      role.id,
      { permissionCodes: ['sales:manage'] },
      actor,
    );

    expect(result).toEqual({
      roleCode: RoleCode.ADMIN,
      permissionCodes: ['sales:manage'],
    });
    expect(fixture.roleRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: [permission] }),
    );
    expect(fixture.auditRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ROLE_PERMISSIONS_UPDATED',
        before_permission_codes: ['sales:read'],
        after_permission_codes: ['sales:manage'],
        actor_user_id: actor.id,
      }),
    );
  });

  it('thay quyền riêng của user và ghi lại before/after', async () => {
    const fixture = createFixture();
    const user = Object.assign(new User(), {
      id: 21,
      account: 'staff-21',
      role: { code: RoleCode.STAFF },
      user_profile: { nickname: 'Nhân viên' },
    });
    const existingGrant = Object.assign(new UserPermission(), {
      user_id: user.id,
      permission_id: 1,
      permission: { id: 1, code: 'sales:read' },
    });
    const nextPermission = Object.assign(new Permission(), {
      id: 2,
      code: 'sales:manage',
    });
    const actor = Object.assign(new User(), {
      id: 9,
      account: 'super-admin',
      role: { code: RoleCode.SUPER_ADMIN },
    });
    fixture.userRepository.findOne.mockResolvedValue(user);
    fixture.grantRepository.find.mockResolvedValue([existingGrant]);
    fixture.permissionRepository.find.mockResolvedValue([nextPermission]);

    const result = await fixture.service.updateUserPermissions(
      user.id,
      { permissionCodes: ['sales:manage'] },
      actor,
    );

    expect(result).toEqual({
      userId: user.id,
      directPermissionCodes: ['sales:manage'],
    });
    expect(fixture.grantRepository.delete).toHaveBeenCalledTimes(1);
    expect(fixture.grantRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: user.id,
        permission_id: nextPermission.id,
        granted_by_user_id: actor.id,
      }),
    ]);
    expect(fixture.auditRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_PERMISSIONS_UPDATED',
        target_user_id: user.id,
        before_permission_codes: ['sales:read'],
        after_permission_codes: ['sales:manage'],
      }),
    );
  });

  it('từ chối permission code không có trong catalog', async () => {
    const fixture = createFixture();
    const role = Object.assign(new Role(), {
      id: 2,
      code: RoleCode.ADMIN,
      permissions: [],
    });
    fixture.roleRepository.findOne.mockResolvedValue(role);
    fixture.permissionRepository.find.mockResolvedValue([]);

    await expect(
      fixture.service.updateRolePermissions(
        role.id,
        { permissionCodes: ['unknown:permission'] },
        Object.assign(new User(), { id: 9, account: 'super-admin' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fixture.roleRepository.save).not.toHaveBeenCalled();
    expect(fixture.auditRepository.save).not.toHaveBeenCalled();
  });
});
