import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

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

    // Kiểm tra xem user có role và permissions không
    if (!user.role || !user.role.permissions) {
      throw new ForbiddenException('User has no permissions');
    }

    // Lấy danh sách permission codes của user
    const userPermissions = user.role.permissions.map((p: any) => p.code);

    // Kiểm tra xem user có ít nhất một trong các permissions yêu cầu không
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `You need one of these permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
