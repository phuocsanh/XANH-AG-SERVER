import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleCode } from '../enums/role-code.enum';

/**
 * Guard kiểm tra quyền hạn (permissions) của user
 * Sử dụng cùng với decorator @RequirePermissions()
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lấy danh sách permissions yêu cầu từ decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nếu không yêu cầu permission nào, cho phép truy cập
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Lấy thông tin user từ request (đã được set bởi JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Kết hợp quyền từ role và quyền được cấp trực tiếp cho user.
    if (!user.role) {
      throw new ForbiddenException('User has no permissions');
    }

    // Super Admin luôn có toàn quyền, kể cả permission mới chưa seed vào role.
    if (user.role.code === RoleCode.SUPER_ADMIN) return true;

    const userPermissions = new Set<string>([
      ...(user.role.permissions ?? []).map((permission: { code: string }) => permission.code),
      ...(user.direct_permissions ?? []).map((permission: { code: string }) => permission.code),
    ]);

    // Kiểm tra xem user có ít nhất một trong các permissions yêu cầu không
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.has(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `You need one of these permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
