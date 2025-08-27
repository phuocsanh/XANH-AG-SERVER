import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

/**
 * Pipe chuyển đổi và xác thực dữ liệu đầu vào
 * Kiểm tra tính hợp lệ của dữ liệu dựa trên các decorator validation
 */
@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  /**
   * Phương thức chuyển đổi và xác thực dữ liệu
   * @param value - Giá trị cần xác thực
   * @param metadata - Metadata của tham số
   * @returns Giá trị đã được xác thực
   */
  async transform(value: any, { metatype }: ArgumentMetadata) {
    // Nếu không có kiểu dữ liệu hoặc không cần xác thực thì trả về giá trị gốc
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Chuyển đổi dữ liệu thô thành instance của class
    const object = plainToInstance(metatype, value);

    // Thực hiện xác thực dữ liệu
    const errors = await validate(object);

    // Nếu có lỗi xác thực thì throw exception
    if (errors.length > 0) {
      throw new BadRequestException('Validation failed');
    }

    // Trả về giá trị đã được xác thực
    return value;
  }

  /**
   * Kiểm tra xem kiểu dữ liệu có cần xác thực không
   * @param metatype - Kiểu dữ liệu cần kiểm tra
   * @returns true nếu cần xác thực, false nếu không
   */
  private toValidate(metatype: Function): boolean {
    // Các kiểu dữ liệu nguyên thủy không cần xác thực
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
