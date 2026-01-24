import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Guard kiểm tra quyền sở hữu (ownership) của resource
 * - ADMIN/SUPER_ADMIN: Được phép thao tác với TẤT CẢ resources
 * - USER: Chỉ được phép thao tác với resources DO MÌNH TẠO
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Lấy entity type từ decorator @CheckOwnership
    const entityName = this.reflector.get<string>(
      'entityName',
      context.getHandler(),
    );

    // Nếu không có decorator, skip ownership check
    if (!entityName) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceId = request.params.id;

    // Nếu không có user (chưa login), từ chối
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // ADMIN và SUPER_ADMIN có quyền với TẤT CẢ resources
    if (['ADMIN', 'SUPER_ADMIN'].includes(user.role?.code)) {
      return true;
    }

    // Lấy repository của entity
    const repository = this.dataSource.getRepository(entityName);

    // Tìm resource chỉ theo ID trước để xác định sự tồn tại (404 vs 403)
    // Chuyển sang kiểu dữ liệu phù hợp (Postgres integers/bigint)
    const numericId = !isNaN(Number(resourceId)) ? Number(resourceId) : resourceId;
    
    const resource = await repository.findOne({
      where: { id: numericId } as any
    });

    // Nếu thực sự không tồn tại trong DB -> 404
    if (!resource) {
      throw new NotFoundException(
        `${entityName} với ID ${resourceId} không tồn tại trên hệ thống`,
      );
    }

    // Nếu tồn tại, kiểm tra quyền sở hữu (Ownership)
    // 1. Kiểm tra trực tiếp: created_by_user_id (cho các entity có field này)
    const creatorId = (resource as any).created_by_user_id || (resource as any).user_id;
    if (creatorId && creatorId === user.id) {
      return true;
    }

    // 2. Kiểm tra thông qua Vụ lúa (RiceCrop) - Dành cho CostItem, Schedule...
    // Nếu có rice_crop_id, chúng ta cần xem vụ lúa đó là của ai
    const targetRiceCropId = (resource as any).rice_crop_id;
    if (targetRiceCropId) {
      const riceCropRepository = this.dataSource.getRepository('RiceCrop');
      const riceCrop = await riceCropRepository.findOne({
        where: { id: targetRiceCropId }
      });

      if (riceCrop && Number(riceCrop.customer_id) === Number(user.customer_id)) {
        return true;
      }
    }

    // 3. Kiểm tra trực tiếp customer_id (cho bản thân RiceCrop)
    const resourceCustomerId = (resource as any).customer_id;
    if (resourceCustomerId && Number(resourceCustomerId) === Number(user.customer_id)) {
      return true;
    }

    // Mặc định: Nếu có cơ chế kiểm tra mà không khớp -> 403 (Không có quyền)
    throw new ForbiddenException(
      `Bạn không có quyền thao tác trên ${entityName.toLowerCase()} này`,
    );
  }
}
