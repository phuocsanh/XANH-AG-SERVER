import { PartialType } from '@nestjs/mapped-types';
import { CreateProductTypeDto } from './create-product-type.dto';

/**
 * DTO cho việc cập nhật loại sản phẩm
 * Kế thừa từ CreateProductTypeDto với tất cả các trường là optional
 */
export class UpdateProductTypeDto extends PartialType(CreateProductTypeDto) {}