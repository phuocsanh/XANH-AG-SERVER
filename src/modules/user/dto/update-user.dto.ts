import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * DTO (Data Transfer Object) dùng để cập nhật thông tin người dùng
 * Kế thừa từ CreateUserDto nhưng tất cả các trường đều là tùy chọn
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}