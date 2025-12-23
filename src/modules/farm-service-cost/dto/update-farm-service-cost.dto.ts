import { PartialType } from '@nestjs/swagger';
import { CreateFarmServiceCostDto } from './create-farm-service-cost.dto';

/**
 * DTO để cập nhật chi phí dịch vụ cho nông dân
 * Tất cả các trường đều optional
 */
export class UpdateFarmServiceCostDto extends PartialType(CreateFarmServiceCostDto) {}
