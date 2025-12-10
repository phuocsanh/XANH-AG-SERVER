import { PartialType } from '@nestjs/mapped-types';
import { CreateOperatingCostCategoryDto } from './create-operating-cost-category.dto';

/**
 * DTO để cập nhật loại chi phí vận hành
 * Tất cả fields đều optional
 */
export class UpdateOperatingCostCategoryDto extends PartialType(CreateOperatingCostCategoryDto) {}
