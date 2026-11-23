import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RoleCode } from '../enums/role-code.enum';

/** Chỉ cho phép tài khoản mang role SUPER_ADMIN gọi API quản trị quyền. */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role?.code !== RoleCode.SUPER_ADMIN) {
      throw new ForbiddenException('Chỉ SUPER_ADMIN được quản lý phân quyền hệ thống');
    }
    return true;
  }
}
