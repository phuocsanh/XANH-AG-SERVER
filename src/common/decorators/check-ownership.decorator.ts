import { SetMetadata } from '@nestjs/common';

/**
 * Decorator để đánh dấu endpoint cần kiểm tra ownership
 * @param entityName - Tên entity cần kiểm tra (ví dụ: 'CostItem', 'HarvestRecord')
 * 
 * @example
 * ```typescript
 * @Delete(':id')
 * @UseGuards(JwtAuthGuard, PermissionsGuard, OwnershipGuard)
 * @RequirePermissions('cost_item:delete')
 * @CheckOwnership('CostItem')
 * async delete(@Param('id') id: number) {
 *   return this.service.delete(id);
 * }
 * ```
 */
export const CheckOwnership = (entityName: string) =>
  SetMetadata('entityName', entityName);
