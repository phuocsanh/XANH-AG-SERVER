import { PartialType } from '@nestjs/mapped-types';
import { CreateProductTypeDto } from './create-product-type.dto';

/**
 * DTO cho việc cập nhật loại sản phẩm
 * Kế thừa từ CreateProductTypeDto nhưng tất cả các field đều optional
 */
export class UpdateProductTypeDto extends PartialType(CreateProductTypeDto) {}