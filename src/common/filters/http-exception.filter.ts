import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Bộ lọc xử lý các exception HTTP
 * Chuyển đổi exception thành response JSON chuẩn hóa
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * Phương thức xử lý exception
   * @param exception - Exception được bắt
   * @param host - ArgumentsHost chứa context của request/response
   */
  catch(exception: HttpException, host: ArgumentsHost) {
    // Lấy context HTTP từ host
    const ctx = host.switchToHttp();

    // Lấy response và request từ context
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Lấy status code từ exception
    const status = exception.getStatus();

    // Trả về response JSON chuẩn hóa
    response.status(status).json({
      statusCode: status, // Mã trạng thái HTTP
      timestamp: new Date().toISOString(), // Thời gian xảy ra lỗi
      path: request.url, // Đường dẫn gây ra lỗi
      message: exception.message, // Thông điệp lỗi
    });
  }
}
