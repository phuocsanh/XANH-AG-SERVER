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

    // Chuyển resourceId sang number nếu cần (nếu ID column là number)
    const numericId = !isNaN(Number(resourceId)) ? Number(resourceId) : resourceId;

    // Tìm resource theo ID, tự động load rice_crop nếu có thể để check ownership cho CostItem/Schedule
    const resource = await repository.findOne({
      where: { id: numericId } as any,
      relations: (repository.metadata.columns.some(c => c.propertyName === 'rice_crop_id') || 
                  repository.metadata.relations.some(r => r.propertyName === 'rice_crop')) 
                  ? ['rice_crop'] : [],
    }) as any;

    // Nếu không tìm thấy resource
    if (!resource) {
      throw new NotFoundException(
        `${entityName} with ID ${resourceId} not found`,
      );
    }

    // Kiểm tra ownership theo nhiều cách:
    // 1. created_by_user_id (cho các entity có field này)
    // 2. user_id (cho các entity liên kết trực tiếp với user)
    // 3. customer_id (cho rice-crop và các entity thuộc customer)
    // 4. rice_crop -> customer_id (cho các entity con của vụ lúa)
    
    const creatorId = resource.created_by_user_id || resource.user_id;
    const resourceCustomerId = resource.customer_id || resource.rice_crop?.customer_id;

    // Nếu resource có created_by_user_id hoặc user_id
    if (creatorId) {
      if (creatorId !== user.id) {
        throw new ForbiddenException(
          `You can only modify your own ${entityName.toLowerCase()}`,
        );
      }
      return true;
    }

    // Nếu resource có customer_id (trực tiếp hoặc qua rice_crop)
    if (resourceCustomerId) {
      // Kiểm tra user có customer_id không
      if (!user.customer_id) {
        throw new ForbiddenException(
          'You must be a customer to access this resource',
        );
      }

      const userCustomerId = Number(user.customer_id);
      const targetCustomerId = Number(resourceCustomerId);

      if (userCustomerId !== targetCustomerId) {
        throw new ForbiddenException(
          `You can only modify your own ${entityName.toLowerCase()}`,
        );
      }
      return true;
    }

    // Nếu resource không có thông tin ownership, cho phép
    // (có thể là data cũ hoặc entity không track ownership)
    return true;
  }
}
