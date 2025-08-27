import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Guard kiểm tra xác thực người dùng
 * Được sử dụng để bảo vệ các route yêu cầu xác thực
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * Phương thức kiểm tra quyền truy cập
   * @param context - ExecutionContext chứa thông tin về execution context
   * @returns true nếu được phép truy cập, false nếu không
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }

  /**
   * Phương thức kiểm tra tính hợp lệ của request
   * @param request - Request object cần kiểm tra
   * @returns true nếu request hợp lệ, false nếu không
   */
  private validateRequest(request: any): boolean {
    // Implement your authentication logic here
    // For now, we'll just return true for demonstration
    return true;
  }
}
