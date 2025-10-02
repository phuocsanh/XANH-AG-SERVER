import { PartialType } from '@nestjs/mapped-types';
import { CreateProductSubtypeDto } from './create-product-subtype.dto';

/**
 * DTO cho việc cập nhật loại phụ sản phẩm
 * Kế thừa từ CreateProductSubtypeDto nhưng tất cả các trường đều là tùy chọn
 */
export class UpdateProductSubtypeDto extends PartialType(CreateProductSubtypeDto) {}