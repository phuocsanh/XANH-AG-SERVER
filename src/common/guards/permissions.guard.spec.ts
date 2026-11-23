import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { RoleCode } from '../enums/role-code.enum';

describe('PermissionsGuard', () => {
  const makeContext = (user: unknown) => ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

  const makeGuard = (requiredPermissions: string[]) => new PermissionsGuard({
    getAllAndOverride: jest.fn().mockReturnValue(requiredPermissions),
  } as unknown as Reflector);

  it('accepts a permission granted directly to the user', () => {
    const guard = makeGuard(['sales:manage']);
    const context = makeContext({
      role: { code: RoleCode.STAFF, permissions: [{ code: 'sales:read' }] },
      direct_permissions: [{ code: 'sales:manage' }],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies a permission absent from both role and user grants', () => {
    const guard = makeGuard(['sales:manage']);
    const context = makeContext({ role: { code: RoleCode.STAFF, permissions: [] } });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows Super Admin regardless of the seeded permission list', () => {
    const guard = makeGuard(['permission:added_later']);
    const context = makeContext({ role: { code: RoleCode.SUPER_ADMIN, permissions: [] } });

    expect(guard.canActivate(context)).toBe(true);
  });
});
