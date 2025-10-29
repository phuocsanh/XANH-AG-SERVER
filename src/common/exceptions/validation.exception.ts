import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception dùng khi có lỗi xác thực dữ liệu
 */
export class ValidationException extends HttpException {
  constructor(message: string, errors?: any[]) {
    super(
      {
        error: 'Validation Error',
        message,
        details: errors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
