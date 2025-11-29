import { SetMetadata } from '@nestjs/common';

/**
 * Decorator để yêu cầu permissions cho một endpoint
 * @param permissions - Danh sách mã permissions cần thiết
 * @example
 * @RequirePermissions('USER_CREATE', 'USER_UPDATE')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
