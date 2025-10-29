import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception dùng khi không tìm thấy tài nguyên
 */
export class ResourceNotFoundException extends HttpException {
  constructor(message: string, resource?: string) {
    super(
      {
        error: 'Resource Not Found',
        message,
        resource,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
