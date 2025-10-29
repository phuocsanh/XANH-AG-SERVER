import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception dùng khi có lỗi liên quan đến cơ sở dữ liệu
 */
export class DatabaseException extends HttpException {
  constructor(message: string, error?: any) {
    super(
      {
        error: 'Database Error',
        message,
        details: error,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
