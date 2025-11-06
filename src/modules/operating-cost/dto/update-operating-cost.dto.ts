import { PartialType } from '@nestjs/mapped-types';
import { CreateOperatingCostDto } from './create-operating-cost.dto';

/**
 * DTO (Data Transfer Object) dùng để cập nhật thông tin chi phí vận hành
 * Kế thừa từ CreateOperatingCostDto nhưng tất cả các trường đều là tùy chọn
 */
export class UpdateOperatingCostDto extends PartialType(
  CreateOperatingCostDto,
) {}
