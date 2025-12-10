import { PartialType } from '@nestjs/mapped-types';
import { CreateCostItemCategoryDto } from './create-cost-item-category.dto';

/**
 * DTO để cập nhật loại chi phí canh tác
 */
export class UpdateCostItemCategoryDto extends PartialType(CreateCostItemCategoryDto) {}
