import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception dùng khi có lỗi logic nghiệp vụ
 */
export class BusinessLogicException extends HttpException {
  constructor(message: string, code?: string) {
    super(
      {
        error: 'Business Logic Error',
        message,
        code,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
