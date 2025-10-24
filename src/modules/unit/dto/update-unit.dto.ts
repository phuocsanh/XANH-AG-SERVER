import { PartialType } from '@nestjs/mapped-types';
import { CreateUnitDto } from './create-unit.dto';

/**
 * DTO (Data Transfer Object) dùng để cập nhật thông tin đơn vị tính
 * Kế thừa từ CreateUnitDto nhưng tất cả các trường đều là tùy chọn
 */
export class UpdateUnitDto extends PartialType(CreateUnitDto) {}
