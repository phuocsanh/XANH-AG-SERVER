import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception dùng khi có bản ghi trùng lặp trong cơ sở dữ liệu
 */
export class DuplicateRecordException extends HttpException {
  constructor(message: string, field?: string) {
    super(
      {
        error: 'Duplicate Record',
        message,
        field,
      },
      HttpStatus.CONFLICT,
    );
  }
}
