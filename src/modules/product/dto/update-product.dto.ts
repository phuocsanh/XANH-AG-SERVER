import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

/**
 * DTO (Data Transfer Object) dùng để cập nhật thông tin sản phẩm
 * Kế thừa từ CreateProductDto nhưng tất cả các trường đều là tùy chọn
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}